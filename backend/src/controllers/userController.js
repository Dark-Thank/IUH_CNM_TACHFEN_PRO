import User from "../models/User.js";
import { uploadImageFromBuffer }from "../middlewares/uploadMiddleware.js";
export const authMe = async (req, res) => {
  try {
    const user = req.user; // lấy từ authMiddleware

    return res.status(200).json({
      user,
    });
  } catch (error) {
    console.error("Lỗi khi gọi authMe", error);
    return res.status(500).json({ message: "Lỗi hệ thống" });
  }
    // return res.status(200).json({message: "Đây là route authMe, bạn đã xác thực thành công!"});

};


export const searchUserByUsername = async (req, res) => {
  try {
    const { username } = req.query;

    if (!username || username.trim() === "") {
      return res.status(400).json({ message: "Cần cung cấp username trong query." });
    }

    const user = await User.findOne({ username }).select(
      "_id displayName username avatarUrl"
    );

    return res.status(200).json({ user });
  } catch (error) {
    console.error("Lỗi xảy ra khi searchUserByUsername", error);
    return res.status(500).json({ message: "Lỗi hệ thống" });
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

    if (!updatedUser.avatarUrl) {
      return res.status(400).json({ message: "Avatar trả về null" });
    }

    return res.status(200).json({ avatarUrl: updatedUser.avatarUrl });
  } catch (error) {
    console.error("Lỗi xảy ra khi upload avatar", error);
    return res.status(500).json({ message: "Upload failed" });
  }
};

export const updateMe = async (req, res) => {
  try {
    const userId = req.user._id;
    const { displayName, email, bio, phone } = req.body;
    const updates = {};

    if (typeof displayName === "string") {
      const trimmed = displayName.trim();
      if (!trimmed) {
        return res.status(400).json({ message: "Display name khong duoc de trong." });
      }
      updates.displayName = trimmed;
    }

    if (typeof email === "string") {
      const trimmedEmail = email.trim().toLowerCase();
      if (!trimmedEmail) {
        return res.status(400).json({ message: "Email khong duoc de trong." });
      }
      updates.email = trimmedEmail;
    }

    if (typeof bio === "string") {
      updates.bio = bio.trim();
    }

    if (typeof phone === "string") {
      const trimmedPhone = phone.trim();
      updates.phone = trimmedPhone === "" ? null : trimmedPhone;
    }

    if (Object.keys(updates).length === 0) {
      return res.status(400).json({ message: "Khong co truong nao de cap nhat." });
    }

    const updatedUser = await User.findByIdAndUpdate(
      userId,
      updates,
      { new: true, runValidators: true }
    ).select("_id username email displayName avatarUrl bio phone createdAt updatedAt");

    return res.status(200).json({ user: updatedUser });
  } catch (error) {
    console.error("Loi khi updateMe", error);

    if (error?.code === 11000) {
      return res.status(409).json({ message: "Email da ton tai." });
    }

    return res.status(500).json({ message: "Loi he thong" });
  }
};


export const test = async (req, res) => {
  return res.sendStatus(204);
};
