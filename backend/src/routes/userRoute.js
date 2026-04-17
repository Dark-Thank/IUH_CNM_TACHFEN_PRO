import express from "express";
import {
  authMe,
  changePassword,
  getUserById,
  requestChangePassword,
  searchUserByUsername,
  updateMe,
  uploadAvatar,
} from "../controllers/userController.js";
import { protectedRoute } from "../middlewares/authMiddleware.js";
import { upload, withUploadErrorHandling } from "../middlewares/uploadMiddleware.js";

const router = express.Router();
const avatarUpload = withUploadErrorHandling(upload.single("file"));

router.get("/me", protectedRoute, authMe);
router.get("/search", protectedRoute, searchUserByUsername);
router.post("/uploadAvatar", protectedRoute, avatarUpload, uploadAvatar);
router.post("/change-password", protectedRoute, changePassword);
router.post("/request-change-password", protectedRoute, requestChangePassword);

router.get("/:userId", getUserById);

export default router;
