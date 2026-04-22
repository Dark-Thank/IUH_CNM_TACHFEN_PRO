import express from 'express';
import { createConversation, getConversations, getMessages, markAsSeen, generateInvitationLink, joinGroupByToken } from '../controllers/conversationController.js';
import { checkFriendship } from '../middlewares/friendMiddleware.js';

const router = express.Router();

router.post('/', checkFriendship, createConversation);
router.get('/', getConversations);
router.get('/:conversationId/messages', getMessages);
router.patch("/:conversationId/seen", markAsSeen);
router.post('/:conversationId/generate-invite', generateInvitationLink);
router.post('/join-by-token', joinGroupByToken);

export default router;