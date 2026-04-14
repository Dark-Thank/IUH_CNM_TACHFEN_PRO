import express from "express";
import {
  authMe,
  searchUserByUsername,
  uploadAvatar,
  changePassword,
  requestChangePassword,
} from "../controllers/userController.js";
import { protectedRoute } from "../middlewares/authMiddleware.js";
import { upload } from "../middlewares/uploadMiddleware.js";

const router = express.Router();

router.get("/me", protectedRoute, authMe);
router.get("/search", protectedRoute, searchUserByUsername);
router.post("/uploadAvatar", protectedRoute, upload.single("file"), uploadAvatar);
router.post("/change-password", protectedRoute, changePassword);
router.post("/request-change-password", protectedRoute, requestChangePassword);

export default router;
