import express from 'express';
import { protect } from '../middleware/auth.middleware.js';
import * as expenseController from '../controllers/expense.controller.js';

const router = express.Router();

router.post('/', protect, expenseController.addExpense);
router.post('/settle', protect, expenseController.settleDebt);
router.put('/:id/approve', protect, expenseController.approveSettlement);
router.put('/:id/decline', protect, expenseController.declineSettlement);
router.get('/group/:groupId', protect, expenseController.getGroupExpenses);

export default router;
