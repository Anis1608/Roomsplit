import Expense from '../models/Expense.model.js';
import Group from '../models/Group.model.js';
import { io } from '../server.js';
import { sendApprovalEmail } from '../utils/email.js';

const populateExpense = (query) =>
  query
    .populate('paidBy', 'name email')
    .populate('splitAmong', 'name email')
    .populate('exactSplits.user', 'name email')
    .populate('createdBy', 'name email');

export const addExpense = async (req, res) => {
  try {
    const { groupId, description, amount, paidBy, splitAmong, splitType, exactSplits } = req.body;

    const group = await Group.findById(groupId);
    if (!group) return res.status(404).json({ message: 'Group not found' });

    const expense = await Expense.create({
      groupId,
      description,
      amount,
      paidBy,
      splitAmong,
      splitType,
      exactSplits,
      createdBy: req.user._id
    });

    const populatedExpense = await populateExpense(Expense.findById(expense._id));

    // Emit socket event for real-time update
    io.to(groupId).emit('new_expense', populatedExpense);

    res.status(201).json(populatedExpense);
  } catch (error) { res.status(500).json({ message: error.message }); }
};

export const getGroupExpenses = async (req, res) => {
  try {
    const expenses = await populateExpense(
      Expense.find({ groupId: req.params.groupId }).sort({ date: -1 })
    );
    res.json(expenses);
  } catch (error) { res.status(500).json({ message: error.message }); }
};

export const settleDebt = async (req, res) => {
  try {
    const { groupId, amount, paidBy, splitAmong } = req.body;
    
    const group = await Group.findById(groupId);
    if (!group) return res.status(404).json({ message: 'Group not found' });
    
    // Create the settlement expense as PENDING
    const expense = await Expense.create({
      groupId,
      description: `⏳ Pending Settlement`,
      amount,
      paidBy,
      splitAmong,
      status: 'pending',
      createdBy: req.user._id
    });

    const populatedExpense = await populateExpense(Expense.findById(expense._id));

    io.to(groupId).emit('new_expense', populatedExpense);

    res.status(201).json(populatedExpense);
  } catch (error) { res.status(500).json({ message: error.message }); }
};

export const approveSettlement = async (req, res) => {
  try {
    const expense = await populateExpense(Expense.findById(req.params.id));
      
    if (!expense) return res.status(404).json({ message: 'Expense not found' });
    
    expense.status = 'completed';
    expense.description = '✅ Approved Settlement';
    await expense.save();

    const group = await Group.findById(expense.groupId);
    
    io.to(expense.groupId.toString()).emit('update_expense', expense);

    const approver = expense.splitAmong[0];
    const payer = expense.paidBy;
    
    if (payer && payer.email) {
      await sendApprovalEmail(payer.email, payer.name, approver.name, expense.amount, group.name);
    }
    
    res.json(expense);
  } catch (error) { res.status(500).json({ message: error.message }); }
};

export const declineSettlement = async (req, res) => {
  try {
    const expense = await populateExpense(Expense.findById(req.params.id));
      
    if (!expense) return res.status(404).json({ message: 'Expense not found' });
    
    expense.status = 'rejected';
    expense.description = '❌ Declined Settlement';
    await expense.save();

    io.to(expense.groupId.toString()).emit('update_expense', expense);
    
    res.json(expense);
  } catch (error) { res.status(500).json({ message: error.message }); }
};

export const deleteExpense = async (req, res) => {
  try {
    const expense = await Expense.findById(req.params.id);
    if (!expense) return res.status(404).json({ message: 'Expense not found' });

    // Only the creator may delete
    const creatorId = expense.createdBy ? expense.createdBy.toString() : null;
    if (!creatorId || creatorId !== req.user._id.toString()) {
      return res.status(403).json({ message: 'Only the creator can delete this expense' });
    }

    const groupId = expense.groupId.toString();
    await expense.deleteOne();

    // Notify all group members of the deletion
    io.to(groupId).emit('delete_expense', { _id: req.params.id, groupId });

    res.json({ message: 'Expense deleted successfully', _id: req.params.id });
  } catch (error) { res.status(500).json({ message: error.message }); }
};
