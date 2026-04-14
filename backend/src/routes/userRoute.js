import express from "express";
import {
  authMe,
  searchUserByUsername,
  updateMe,
  uploadAvatar,
} from "../controllers/userController.js";
import { upload } from "../middlewares/uploadMiddleware.js";

const router = express.Router();

router.get("/me", authMe);
router.patch("/me", updateMe);
router.get("/search", searchUserByUsername);
router.post("/uploadAvatar", upload.single("file"), uploadAvatar);

export default router;
