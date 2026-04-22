import express from 'express';
import {
  createConversation,
  getConversations,
  getMessages,
  markAsSeen,
  updateGroupAvatar
} from '../controllers/conversationController.js';

import { checkFriendship } from '../middlewares/friendMiddleware.js';
import { protectedRoute } from '../middlewares/authMiddleware.js';
import { upload, withUploadErrorHandling } from '../middlewares/uploadMiddleware.js';
import { renameGroup } from '../controllers/conversationController.js';
const router = express.Router();

const avatarUpload = withUploadErrorHandling(
  upload.single("avatar")
);

router.post('/', checkFriendship, createConversation);
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

export default router;