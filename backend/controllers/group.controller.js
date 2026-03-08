import Group from '../models/Group.model.js';
import Expense from '../models/Expense.model.js';
import { calculateBalances } from '../utils/balanceCalculation.js';

export const createGroup = async (req, res) => {
  try {
    const { name, members } = req.body;
    const newMembers = members.includes(req.user._id.toString()) ? members : [...members, req.user._id];

    const group = await Group.create({
      name,
      creator: req.user._id,
      members: newMembers,
      presets: [{ name: 'All Members', members: newMembers }]
    });

    res.status(201).json(group);
  } catch (error) { res.status(500).json({ message: error.message }); }
};

export const getGroups = async (req, res) => {
  try {
    const groups = await Group.find({ members: req.user._id }).populate('members', 'name email upiId');
    res.json(groups);
  } catch (error) { res.status(500).json({ message: error.message }); }
};

export const getGroupById = async (req, res) => {
  try {
    const group = await Group.findById(req.params.id)
      .populate('members', 'name email upiId')
      .populate('presets.members', 'name email upiId');
      
    if (!group) return res.status(404).json({ message: 'Group not found' });
    
    const expenses = await Expense.find({ groupId: req.params.id })
      .populate('paidBy', 'name email')
      .populate('splitAmong', 'name email')
      .populate('exactSplits.user', 'name email')
      .populate('createdBy', 'name email');
      
    const { usersData: balances, simplifiedDebts } = calculateBalances(expenses);

    res.json({ group, balances, simplifiedDebts, expenses });
  } catch (error) { res.status(500).json({ message: error.message }); }
};

export const addMember = async (req, res) => {
  try {
    const group = await Group.findById(req.params.id);
    if (!group) return res.status(404).json({ message: 'Group not found' });
    
    const { userId } = req.body;
    if (!group.members.includes(userId)) {
      group.members.push(userId);
      await group.save();
    }
    res.json(group);
  } catch (error) { res.status(500).json({ message: error.message }); }
};

export const addPreset = async (req, res) => {
  try {
    const group = await Group.findById(req.params.id);
    if (!group) return res.status(404).json({ message: 'Group not found' });
    
    const { name, members } = req.body;
    group.presets.push({ name, members });
    await group.save();
    
    res.json(group);
  } catch (error) { res.status(500).json({ message: error.message }); }
};
