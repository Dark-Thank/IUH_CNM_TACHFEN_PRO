import express from 'express';
import {
  closeGroupPoll,
  createGroupAppointment,
  createGroupPoll,
  deleteGroupAppointment,
  deleteMessageForMe,
  downloadMessageFile,
  recallMessage,
  respondToGroupAppointment,
  sendDirectMessage,
  sendGroupMessage,
  toggleReaction,
  togglePinMessage,
  voteOnGroupPoll,
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
  "/group/poll",
  protectedRoute,
  checkGroupMembership,
  createGroupPoll
);
router.post(
  "/group/appointment",
  protectedRoute,
  checkGroupMembership,
  createGroupAppointment
);
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
router.post(
  "/:messageId/poll-vote",
  protectedRoute,
  voteOnGroupPoll
);
router.post(
  "/:messageId/poll-close",
  protectedRoute,
  closeGroupPoll
);
router.post(
  "/:messageId/appointment-response",
  protectedRoute,
  respondToGroupAppointment
);
router.delete(
  "/:messageId/appointment",
  protectedRoute,
  deleteGroupAppointment
);


export default router;
