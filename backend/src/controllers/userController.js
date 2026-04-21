import bcrypt from "bcrypt";
import { uploadImageFromBuffer } from "../middlewares/uploadMiddleware.js";
import Block from "../models/Block.js";
import Conversation from "../models/Conversation.js";
import Friend from "../models/Friend.js";
import FriendRequest from "../models/FriendRequest.js";
import Message from "../models/Message.js";
import Session from "../models/Session.js";
import User from "../models/User.js";
import { getRealtimeConfig as getRealtimeConfigPayload } from "../utils/realtimeConfig.js";

const getUnreadCountEntries = (unreadCounts) => {
  if (!unreadCounts) {
    return [];
  }

  if (unreadCounts instanceof Map) {
    return Array.from(unreadCounts.entries());
  }

  if (typeof unreadCounts.entries === "function") {
    return Array.from(unreadCounts.entries());
  }

  return Object.entries(unreadCounts);
};

const syncConversationAfterUserDeletion = async (conversation, deletedUserId) => {
  const deletedUserIdStr = deletedUserId.toString();
  const remainingParticipants = (conversation.participants || []).filter(
    (participant) => participant.userId?.toString() !== deletedUserIdStr
  );

  if (conversation.type === "direct" || remainingParticipants.length === 0) {
    await Message.deleteMany({ conversationId: conversation._id });
    await Conversation.deleteOne({ _id: conversation._id });
    return;
  }

  const latestMessage = await Message.findOne({
    conversationId: conversation._id,
  }).sort({ createdAt: -1 });

  const nextUnreadCounts = new Map();

  if (latestMessage) {
    getUnreadCountEntries(conversation.unreadCounts).forEach(([userId, count]) => {
      if (userId.toString() !== deletedUserIdStr) {
        nextUnreadCounts.set(userId.toString(), Number(count) || 0);
      }
    });
  } else {
    remainingParticipants.forEach((participant) => {
      nextUnreadCounts.set(participant.userId.toString(), 0);
    });
  }

  conversation.participants = remainingParticipants;
  conversation.seenBy = latestMessage
    ? (conversation.seenBy || []).filter((seenUserId) =>
      remainingParticipants.some(
        (participant) => participant.userId.toString() === seenUserId.toString()
      )
    )
    : [];
  conversation.unreadCounts = nextUnreadCounts;

  if (conversation.group?.createdBy?.toString() === deletedUserIdStr) {
    const nextOwner = remainingParticipants[0] ?? null;

    conversation.group.createdBy = nextOwner?.userId ?? undefined;
    conversation.participants = remainingParticipants.map((participant, index) => ({
      ...participant.toObject?.() ?? participant,
      role: index === 0 ? "owner" : participant.role === "owner" ? "member" : (participant.role || "member"),
    }));
  }

  conversation.lastMessageAt = latestMessage?.createdAt ?? null;
  conversation.lastMessage = latestMessage
    ? {
      _id: latestMessage._id.toString(),
      content: latestMessage.content ?? null,
      senderId: latestMessage.senderId,
      createdAt: latestMessage.createdAt,
    }
    : null;

  await conversation.save();
};

export const authMe = async (req, res) => {
  try {
    return res.status(200).json({
      user: req.user,
    });
  } catch (error) {
    console.error("Loi khi goi authMe", error);
    return res.status(500).json({ message: "Loi he thong" });
  }
};

export const getRealtimeConfig = async (_req, res) => {
  try {
    return res.status(200).json(getRealtimeConfigPayload());
  } catch (error) {
    console.error("Loi khi lay realtime config", error);
    return res.status(500).json({ message: "Loi he thong" });
  }
};

export const searchUserByUsername = async (req, res) => {
  try {
    const { username } = req.query;

    if (!username || username.trim() === "") {
      return res.status(400).json({ message: "Can cung cap username trong query." });
    }

    const user = await User.findOne({ username }).select(
      "_id displayName username avatarUrl"
    );

    return res.status(200).json({ user });
  } catch (error) {
    console.error("Loi xay ra khi searchUserByUsername", error);
    return res.status(500).json({ message: "Loi he thong" });
  }
};

export const getUserById = async (req, res) => {
  try {
    const { userId } = req.params;

    if (!userId) {
      return res.status(400).json({ message: "Can cung cap userId." });
    }

    const user = await User.findById(userId).select(
      "_id displayName username avatarUrl email bio phone createdAt"
    );

    if (!user) {
      return res.status(404).json({ message: "Khong tim thay nguoi dung." });
    }

    return res.status(200).json({ user });
  } catch (error) {
    console.error("Loi xay ra khi getUserById", error);
    return res.status(500).json({ message: "Loi he thong" });
  }
};

export const uploadAvatar = async (req, res) => {
  try {
    const file = req.file;
    const userId = req.user._id;

    if (!file) {
      return res.status(400).json({ message: "No file uploaded" });
    }

    const result = await uploadImageFromBuffer(file.buffer);
    const updatedUser = await User.findByIdAndUpdate(
      userId,
      {
        avatarUrl: result.secure_url,
        avatarId: result.public_id,
      },
      {
        new: true,
      }
    ).select("avatarUrl");

    if (!updatedUser?.avatarUrl) {
      return res.status(400).json({ message: "Avatar tra ve null" });
    }

    return res.status(200).json({ avatarUrl: updatedUser.avatarUrl });
  } catch (error) {
    console.error("Loi xay ra khi upload avatar", error);
    return res.status(500).json({ message: "Upload failed" });
  }
};

export const updateMe = async (req, res) => {
  try {
    const userId = req.user._id;
    const { displayName, bio } = req.body;
    const updates = {};

    if (typeof displayName === "string") {
      const trimmedDisplayName = displayName.trim();

      if (!trimmedDisplayName) {
        return res.status(400).json({ message: "Display name khong duoc de trong." });
      }

      updates.displayName = trimmedDisplayName;
    }

    if (typeof bio === "string") {
      updates.bio = bio.trim();
    }

    if (Object.keys(updates).length === 0) {
      return res.status(400).json({ message: "Khong co truong nao de cap nhat." });
    }

    const updatedUser = await User.findByIdAndUpdate(userId, updates, {
      new: true,
      runValidators: true,
    }).select("_id username email displayName avatarUrl bio phone createdAt updatedAt");

    return res.status(200).json({ user: updatedUser });
  } catch (error) {
    console.error("Loi khi updateMe", error);
    return res.status(500).json({ message: "Loi he thong" });
  }
};

export const deleteMe = async (req, res) => {
  try {
    const userId = req.user._id;
    const conversations = await Conversation.find({
      "participants.userId": userId,
    });

    await Promise.all([
      Message.deleteMany({ senderId: userId }),
      Message.updateMany(
        { pinnedBy: userId },
        {
          $set: { isPinned: false },
          $unset: { pinnedBy: "", pinnedAt: "" },
        }
      ),
      Message.updateMany(
        { recallBy: userId },
        {
          $unset: { recallBy: "" },
        }
      ),
      Session.deleteMany({ userId }),
      Friend.deleteMany({
        $or: [{ userA: userId }, { userB: userId }],
      }),
      FriendRequest.deleteMany({
        $or: [{ from: userId }, { to: userId }],
      }),
      Block.deleteMany({
        $or: [{ blocker: userId }, { blocked: userId }],
      }),
    ]);

    for (const conversation of conversations) {
      await syncConversationAfterUserDeletion(conversation, userId);
    }

    await User.deleteOne({ _id: userId });

    res.clearCookie("refreshToken", {
      httpOnly: true,
      secure: true,
      sameSite: "none",
    });

    return res.status(200).json({ message: "Xoa tai khoan thanh cong." });
  } catch (error) {
    console.error("Loi khi deleteMe", error);
    return res.status(500).json({ message: "Loi he thong" });
  }
};

export const test = async (req, res) => {
  return res.sendStatus(204);
};

export const changePassword = async (req, res) => {
  try {
    const userId = req.user._id;
    const { oldPassword, newPassword } = req.body;

    if (!oldPassword || !newPassword) {
      return res.status(400).json({ message: "Can cung cap oldPassword va newPassword." });
    }

    const user = await User.findById(userId).select("hashedPassword");

    if (!user) {
      return res.status(404).json({ message: "Nguoi dung khong ton tai." });
    }

    const match = await bcrypt.compare(oldPassword, user.hashedPassword);

    if (!match) {
      return res.status(401).json({ message: "Mat khau hien tai khong dung." });
    }

    user.hashedPassword = await bcrypt.hash(newPassword, 10);
    await user.save();

    return res.status(200).json({ message: "Doi mat khau thanh cong." });
  } catch (error) {
    console.error("Loi changePassword", error);
    return res.status(500).json({ message: "Loi he thong" });
  }
};

export const requestChangePassword = async (req, res) => {
  try {
    const userId = req.user._id;
    const { oldPassword, newPassword } = req.body;

    if (!oldPassword || !newPassword) {
      return res.status(400).json({ message: "Can cung cap oldPassword va newPassword." });
    }

    const user = await User.findById(userId).select("hashedPassword email");

    if (!user) {
      return res.status(404).json({ message: "Nguoi dung khong ton tai." });
    }

    const match = await bcrypt.compare(oldPassword, user.hashedPassword);

    if (!match) {
      return res.status(401).json({ message: "Mat khau hien tai khong dung." });
    }

    const resetOtp = Math.floor(100000 + Math.random() * 900000).toString();
    const resetOtpExpires = new Date(Date.now() + 10 * 60 * 1000);

    user.resetOtp = resetOtp;
    user.resetOtpExpires = resetOtpExpires;
    await user.save();

    try {
      const { sendEmail } = await import("../utils/emailService.js");
      sendEmail({
        to: user.email,
        subject: "Ma doi mat khau",
        text: `Ma doi mat khau cua ban: ${resetOtp}. Ma co hieu luc trong 10 phut.`,
      })
        .then(() => console.log("Change-password OTP dispatched"))
        .catch((emailError) => console.error("Gui email OTP that bai", emailError));
    } catch (emailError) {
      console.error("Khong the gui email OTP", emailError);
    }

    return res.status(200).json({
      message: "Ma OTP doi mat khau da duoc gui toi email cua ban.",
    });
  } catch (error) {
    console.error("Loi requestChangePassword", error);
    return res.status(500).json({ message: "Loi he thong" });
  }
};
