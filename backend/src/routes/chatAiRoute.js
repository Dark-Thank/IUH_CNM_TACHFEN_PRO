import express from "express";
import {
  detectUserLanguage,
  getSmartReplies,
  translateMessage,
} from "../controllers/chatAiController.js";

const router = express.Router();

router.post("/smart-replies", getSmartReplies);
router.post("/detect-language", detectUserLanguage);
router.post("/translate", translateMessage);

export default router;
