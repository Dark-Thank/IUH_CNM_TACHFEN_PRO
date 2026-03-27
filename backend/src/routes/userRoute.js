import express from "express";
import { authMe, test } from "../controllers/userController.js";

const router = express.Router();

router.get("/me", authMe);

router.get("/test", test);

export default router;