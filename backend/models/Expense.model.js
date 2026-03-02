import mongoose from 'mongoose';

const expenseSchema = new mongoose.Schema({
  groupId: { type: mongoose.Schema.Types.ObjectId, ref: 'Group', required: true },
  description: { type: String, required: true },
  amount: { type: Number, required: true },
  paidBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  splitAmong: [{ type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true }],
  splitType: { type: String, enum: ['equal', 'exact'], default: 'equal' },
  exactSplits: [{
    user: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    amount: Number
  }],
  status: { type: String, enum: ['pending', 'completed', 'rejected'], default: 'completed' },
  date: { type: Date, default: Date.now }
}, { timestamps: true });

export default mongoose.model('Expense', expenseSchema);
