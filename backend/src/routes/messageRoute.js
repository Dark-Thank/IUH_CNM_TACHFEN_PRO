import express from 'express';
import { sendDirectMessage, sendGroupMessage } from '../controllers/messageController.js';
import { checkFriendship } from '../middlewares/friendMiddleware.js';
import { checkGroupMembership } from '../middlewares/friendMiddleware.js';
import { upload } from "../middlewares/uploadMiddleware.js";

const router = express.Router();



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