import Block from "../models/Block.js";
export const checkBlock = async (req, res, next) => {
  try {
    const senderId = req.user._id;

    const recipientId =
      req.body?.recipientId ||
      req.body?.userId ||
      req.params?.friendId;

    if (!recipientId) return next();

    const block = await Block.findOne({
      $or: [
        { blocker: senderId, blocked: recipientId },
        { blocker: recipientId, blocked: senderId },
      ],
    });

    if (block) {
      const isSenderBlock =
        block.blocker.toString() === senderId.toString();

      return res.status(403).json({
        message: isSenderBlock
          ? "Bạn đã chặn người này"
          : "Bạn đã bị người này chặn",
        type: isSenderBlock ? "YOU_BLOCKED" : "YOU_ARE_BLOCKED",
      });
    }

    next();
  } catch (error) {
    console.error("checkBlock error:", error);
    res.status(500).json({ message: "Lỗi hệ thống" });
  }
};