import express from 'express';
import { protect } from '../middleware/auth.middleware.js';
import * as groupController from '../controllers/group.controller.js';

const router = express.Router();

router.post('/', protect, groupController.createGroup);
router.get('/', protect, groupController.getGroups);
router.get('/:id', protect, groupController.getGroupById);
router.put('/:id/members', protect, groupController.addMember);
router.put('/:id/presets', protect, groupController.addPreset);

export default router;
