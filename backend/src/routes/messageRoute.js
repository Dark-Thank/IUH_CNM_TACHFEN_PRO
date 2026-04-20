import express from 'express';
import {
  deleteMessageForMe,
  downloadMessageFile,
  recallMessage,
  sendDirectMessage,
  sendGroupMessage,
  toggleReaction,
  togglePinMessage,
} from '../controllers/messageController.js';

import { protectedRoute } from '../middlewares/authMiddleware.js';
import { checkBlock } from '../middlewares/blockMiddleware.js';
import { checkGroupMembership } from '../middlewares/friendMiddleware.js';
import { upload, withUploadErrorHandling } from "../middlewares/uploadMiddleware.js";
const router = express.Router();
const messageUpload = withUploadErrorHandling(
  upload.fields([
    { name: "files", maxCount: 10 },
    { name: "images", maxCount: 10 },
  ])
);

router.put('/:messageId/pin', protectedRoute, togglePinMessage);
router.put('/:messageId/recall', protectedRoute, recallMessage);
router.put('/:messageId/delete-for-me', protectedRoute, deleteMessageForMe);
router.get('/:messageId/files/:fileIndex', protectedRoute, downloadMessageFile);
router.post("/:messageId/reaction", protectedRoute, toggleReaction);
router.post(
  "/direct",
  protectedRoute,
  messageUpload,
  checkBlock,
  sendDirectMessage
);

router.post(
  "/group",
  protectedRoute,
  messageUpload,
  checkGroupMembership,
  sendGroupMessage
);


export default router;
