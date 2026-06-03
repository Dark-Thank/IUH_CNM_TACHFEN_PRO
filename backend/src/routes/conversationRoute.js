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
  renameGroup,
  respondToGroupInvitation,
  reviewGroupJoinRequest,
  shareGroupInvitation,
  summarizeConversation,
  toggleConversationPin,
  transferGroupOwnership,
  updateGroupAvatar,
  updateGroupMemberRole,
} from '../controllers/conversationController.js';

import { protectedRoute } from '../middlewares/authMiddleware.js';
import { checkFriendship } from '../middlewares/friendMiddleware.js';
import { upload, withUploadErrorHandling } from '../middlewares/uploadMiddleware.js';
const router = express.Router();

const avatarUpload = withUploadErrorHandling(
  upload.single("avatar")
);

router.post('/', checkFriendship, createConversation);
router.post('/join-by-token', joinGroupByToken);
router.get('/', getConversations);
router.get('/:conversationId/messages', getMessages);
router.get('/:conversationId/summary', summarizeConversation);

router.put(
  "/:id/avatar",
  protectedRoute,
  avatarUpload,
  updateGroupAvatar
);
router.patch(
  "/:id/rename",
  protectedRoute,
  renameGroup
);

router.patch("/:conversationId/seen", markAsSeen);
router.patch("/:conversationId/pin", toggleConversationPin);

router.post('/:conversationId/members', addGroupMembers);
router.delete('/:conversationId/members/:memberId', removeGroupMember);
router.patch('/:conversationId/members/:memberId/role', updateGroupMemberRole);
router.patch('/:conversationId/owner', transferGroupOwnership);
router.post('/:conversationId/leave', leaveGroup);
router.delete('/:conversationId', disbandGroup);
router.post('/:conversationId/generate-invite', generateInvitationLink);
router.post('/:conversationId/share-invite', shareGroupInvitation);
router.post('/:conversationId/join-requests/:userId/review', protectedRoute, reviewGroupJoinRequest);
router.post('/group-invites/:messageId/respond', protectedRoute, respondToGroupInvitation);

export default router;
