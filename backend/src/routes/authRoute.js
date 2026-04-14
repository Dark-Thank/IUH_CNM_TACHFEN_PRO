import express from "express";
import { signOut, signIn, signUp, refreshToken, verifyOtp, forgotPassword, resetPassword } from "../controllers/authController.js";

const router = express.Router();

router.post("/signup", signUp);

router.post("/signin", signIn);

router.post("/signout", signOut);

router.post("/refresh", refreshToken);
// OTP verify for signup/login
router.post("/verify-otp", verifyOtp);

// forgot/reset password
router.post("/forgot-password", forgotPassword);
router.post("/reset-password", resetPassword);

export default router;
