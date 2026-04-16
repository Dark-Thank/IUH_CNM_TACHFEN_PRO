import express from 'express';
import { recallMessage, sendDirectMessage, sendGroupMessage, togglePinMessage } from '../controllers/messageController.js';
import { protectedRoute } from '../middlewares/authMiddleware.js';
import { checkBlock } from '../middlewares/blockMiddleware.js';
import { upload } from "../middlewares/uploadMiddleware.js";

const router = express.Router();
const messageUpload = upload.fields([
  { name: "files", maxCount: 10 },
  { name: "images", maxCount: 10 },
]);

router.put('/:messageId/pin', protectedRoute, togglePinMessage);
router.put('/:messageId/recall', protectedRoute, recallMessage);




router.post(
  "/direct",
  protectedRoute,
  messageUpload,
  checkBlock,
  //checkFriendship,
  sendDirectMessage
);

router.post(
  "/group",
  protectedRoute,
  messageUpload,
  //checkGroupMembership,
  sendGroupMessage
);


export default router;
