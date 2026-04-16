import { io } from "../socket/index.js";

export const blockFriend = async (req, res) => {
  try {
    const { friendId } = req.params;
    const userId = req.user._id;

    // save block
    await Block.create({
      blocker: userId,
      blocked: friendId,
    });

    // 🔥 realtime notify BOTH sides
    io.to(userId.toString()).emit("block:update", {
      type: "BLOCKED",
      userId: friendId,
    });

    io.to(friendId.toString()).emit("block:update", {
      type: "BLOCKED_BY",
      userId,
    });

    return res.status(200).json({ message: "Blocked" });
  } catch (err) {
    return res.status(500).json({ message: "Error" });
  }
};