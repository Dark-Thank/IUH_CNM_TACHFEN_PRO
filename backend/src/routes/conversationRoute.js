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
  renameGroup,
  updateGroupAvatar,
  updateGroupMemberRole,
} from '../controllers/conversationController.js';

import { checkFriendship } from '../middlewares/friendMiddleware.js';
import { protectedRoute } from '../middlewares/authMiddleware.js';
import { upload, withUploadErrorHandling } from '../middlewares/uploadMiddleware.js';
const router = express.Router();

const avatarUpload = withUploadErrorHandling(
  upload.single("avatar")
);

router.post('/', checkFriendship, createConversation);
router.post('/join-by-token', joinGroupByToken);
router.get('/', getConversations);
router.get('/:conversationId/messages', getMessages);

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

router.post('/:conversationId/members', addGroupMembers);
router.delete('/:conversationId/members/:memberId', removeGroupMember);
router.patch('/:conversationId/members/:memberId/role', updateGroupMemberRole);
router.patch('/:conversationId/owner', transferGroupOwnership);
router.post('/:conversationId/leave', leaveGroup);
router.delete('/:conversationId', disbandGroup);
router.post('/:conversationId/generate-invite', generateInvitationLink);

export default router;