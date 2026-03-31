import express from 'express';
import { sendDirectMessage, sendGroupMessage } from '../controllers/messageController.js';
import { checkFriendship } from '../middlewares/friendMiddleware.js';
import { checkGroupMembership } from '../middlewares/friendMiddleware.js';

const router = express.Router();

router.post('/direct', checkFriendship, sendDirectMessage);
router.post('/group', checkGroupMembership, sendGroupMessage);

export default router;