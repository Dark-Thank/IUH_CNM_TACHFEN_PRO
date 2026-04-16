import express from 'express';
import { sendDirectMessage, sendGroupMessage, togglePinMessage, recallMessage } from '../controllers/messageController.js';
import { checkFriendship } from '../middlewares/friendMiddleware.js';
import { checkGroupMembership } from '../middlewares/friendMiddleware.js';

import { protectedRoute } from '../middlewares/authMiddleware.js';

const router = express.Router();

router.put('/:messageId/pin', protectedRoute, togglePinMessage);
router.put('/:messageId/recall', protectedRoute, recallMessage);
import { upload } from "../middlewares/uploadMiddleware.js";




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
