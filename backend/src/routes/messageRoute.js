import express from 'express';
import { sendDirectMessage, sendGroupMessage, togglePinMessage, recallMessage } from '../controllers/messageController.js';
import { checkFriendship } from '../middlewares/friendMiddleware.js';
import { checkGroupMembership } from '../middlewares/friendMiddleware.js';
import { protectedRoute } from '../middlewares/authMiddleware.js';

const router = express.Router();

router.post('/direct', checkFriendship, sendDirectMessage);
router.post('/group', checkGroupMembership, sendGroupMessage);
router.put('/:messageId/pin', protectedRoute, togglePinMessage);
router.put('/:messageId/recall', protectedRoute, recallMessage);

export default router;
