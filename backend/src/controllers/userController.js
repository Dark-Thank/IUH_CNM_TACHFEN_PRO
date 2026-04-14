import { uploadImageFromBuffer } from "../middlewares/uploadMiddleware.js";
import User from "../models/User.js";

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

export const getUserById = async (req, res) => {
  try {
    const { userId } = req.params;

    if (!userId) {
      return res.status(400).json({ message: "Cần cung cấp userId." });
    }

    const user = await User.findById(userId).select(
      "_id displayName username avatarUrl email bio phone createdAt"
    );

    if (!user) {
      return res.status(404).json({ message: "Không tìm thấy người dùng." });
    }

    return res.status(200).json({ user });
  } catch (error) {
    console.error("Lỗi xảy ra khi getUserById", error);
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


export const test = async (req, res) => {
  return res.sendStatus(204);
};

export const changePassword = async (req, res) => {
  try {
    const userId = req.user._id; // protectedRoute đã gắn user (không chứa hashedPassword)
    const { oldPassword, newPassword } = req.body;

    if (!oldPassword || !newPassword) return res.status(400).json({ message: "Cần cung cấp oldPassword và newPassword." });

    const user = await User.findById(userId).select("hashedPassword");
    if (!user) return res.status(404).json({ message: "Người dùng không tồn tại." });

    const match = await import('bcrypt').then(m => m.compare(oldPassword, user.hashedPassword));
    if (!match) return res.status(401).json({ message: "Mật khẩu hiện tại không đúng." });

    const hashed = await import('bcrypt').then(m => m.hash(newPassword, 10));
    user.hashedPassword = hashed;
    await user.save();

    return res.status(200).json({ message: "Đổi mật khẩu thành công." });
  } catch (error) {
    console.error("Lỗi changePassword", error);
    return res.status(500).json({ message: "Lỗi hệ thống" });
  }
};

export const requestChangePassword = async (req, res) => {
  try {
    const userId = req.user._id;
    const { oldPassword, newPassword } = req.body;

    if (!oldPassword || !newPassword) return res.status(400).json({ message: "Cần cung cấp oldPassword và newPassword." });

    const user = await User.findById(userId).select("hashedPassword email");
    if (!user) return res.status(404).json({ message: "Người dùng không tồn tại." });

    const match = await import('bcrypt').then(m => m.compare(oldPassword, user.hashedPassword));
    if (!match) return res.status(401).json({ message: "Mật khẩu hiện tại không đúng." });

    // generate reset OTP and send via email (reuse resetOtp fields)
    const resetOtp = Math.floor(100000 + Math.random() * 900000).toString();
    const resetOtpExpires = new Date(Date.now() + 10 * 60 * 1000);

    user.resetOtp = resetOtp;
    user.resetOtpExpires = resetOtpExpires;
    await user.save();

    // send email asynchronously
    try {
      const { sendEmail } = await import("../utils/emailService.js");
      sendEmail({
        to: user.email,
        subject: "Mã đổi mật khẩu",
        text: `Mã đổi mật khẩu của bạn: ${resetOtp}. Mã có hiệu lực trong 10 phút.`,
      }).then(() => console.log("Change-password OTP dispatched")).catch(e => console.error("Gửi email OTP thất bại", e));
    } catch (e) {
      console.error("Không thể gửi email OTP", e);
    }

    return res.status(200).json({ message: "Mã OTP đổi mật khẩu đã được gửi tới email của bạn." });
  } catch (error) {
    console.error("Lỗi requestChangePassword", error);
    return res.status(500).json({ message: "Lỗi hệ thống" });
  }
};