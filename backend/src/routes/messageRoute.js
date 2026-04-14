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
  upload.array("images", 10),     
  //checkFriendship,
  sendDirectMessage
);

router.post(
  "/group",
  upload.array("images", 10),
  //checkGroupMembership,
  sendGroupMessage
);


export default router;
