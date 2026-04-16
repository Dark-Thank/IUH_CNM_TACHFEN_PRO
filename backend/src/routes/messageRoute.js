import express from 'express';
import { sendDirectMessage, sendGroupMessage, togglePinMessage, recallMessage, downloadMessageFile } from '../controllers/messageController.js';
import { checkFriendship } from '../middlewares/friendMiddleware.js';
import { checkGroupMembership } from '../middlewares/friendMiddleware.js';

import { protectedRoute } from '../middlewares/authMiddleware.js';
import { upload } from "../middlewares/uploadMiddleware.js";

const router = express.Router();

router.put('/:messageId/pin', protectedRoute, togglePinMessage);
router.put('/:messageId/recall', protectedRoute, recallMessage);
router.get('/:messageId/files/:fileIndex', protectedRoute, downloadMessageFile);




router.post(
  "/direct",
  protectedRoute,
  upload.array("files", 10),
  sendDirectMessage
);

router.post(
  "/group",
  protectedRoute,
  upload.array("files", 10),
  sendGroupMessage
);


export default router;
