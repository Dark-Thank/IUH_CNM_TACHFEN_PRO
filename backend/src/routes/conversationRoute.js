import express from 'express';
import {
    addGroupMembers,
    createConversation,
    disbandGroup,
    generateInvitationLink,
    getConversations,
    getMessages,
    joinGroupByToken,
    leaveGroup,
    markAsSeen,
    removeGroupMember,
    transferGroupOwnership,
    updateGroupMemberRole,
} from '../controllers/conversationController.js';
import { checkFriendship } from '../middlewares/friendMiddleware.js';

const router = express.Router();

router.post('/', checkFriendship, createConversation);
router.post('/join-by-token', joinGroupByToken);
router.get('/', getConversations);
router.get('/:conversationId/messages', getMessages);
router.patch("/:conversationId/seen", markAsSeen);

router.post('/:conversationId/members', addGroupMembers);
router.delete('/:conversationId/members/:memberId', removeGroupMember);
router.patch('/:conversationId/members/:memberId/role', updateGroupMemberRole);
router.patch('/:conversationId/owner', transferGroupOwnership);
router.post('/:conversationId/leave', leaveGroup);
router.delete('/:conversationId', disbandGroup);
router.post('/:conversationId/generate-invite', generateInvitationLink);

export default router;