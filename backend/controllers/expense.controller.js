import Expense from '../models/Expense.model.js';
import Group from '../models/Group.model.js';
import { io } from '../server.js';
import { sendApprovalEmail } from '../utils/email.js';

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
      exactSplits
    });

    const populatedExpense = await Expense.findById(expense._id)
      .populate('paidBy', 'name')
      .populate('splitAmong', 'name')
      .populate('exactSplits.user', 'name');

    // Emit socket event for real-time update
    io.to(groupId).emit('new_expense', populatedExpense);

    res.status(201).json(populatedExpense);
  } catch (error) { res.status(500).json({ message: error.message }); }
};

export const getGroupExpenses = async (req, res) => {
  try {
    const expenses = await Expense.find({ groupId: req.params.groupId })
      .populate('paidBy', 'name')
      .populate('splitAmong', 'name')
      .populate('exactSplits.user', 'name')
      .sort({ date: -1 });
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
      status: 'pending'
    });

    const populatedExpense = await Expense.findById(expense._id)
      .populate('paidBy', 'name email')
      .populate('splitAmong', 'name email');

    io.to(groupId).emit('new_expense', populatedExpense);

    res.status(201).json(populatedExpense);
  } catch (error) { res.status(500).json({ message: error.message }); }
};

export const approveSettlement = async (req, res) => {
  try {
    const expense = await Expense.findById(req.params.id)
      .populate('paidBy', 'name email')
      .populate('splitAmong', 'name email');
      
    if (!expense) return res.status(404).json({ message: 'Expense not found' });
    
    expense.status = 'completed';
    expense.description = '✅ Approved Settlement';
    await expense.save();

    const group = await Group.findById(expense.groupId);
    
    io.to(expense.groupId.toString()).emit('update_expense', expense);

    // Send email to the person who PAID the money, confirming it was approved
    // Or send it to both. The original requirement: "tat i have settle that amount"
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
    const expense = await Expense.findById(req.params.id)
      .populate('paidBy', 'name email')
      .populate('splitAmong', 'name email');
      
    if (!expense) return res.status(404).json({ message: 'Expense not found' });
    
    expense.status = 'rejected';
    expense.description = '❌ Declined Settlement';
    await expense.save();

    io.to(expense.groupId.toString()).emit('update_expense', expense);
    
    res.json(expense);
  } catch (error) { res.status(500).json({ message: error.message }); }
};
