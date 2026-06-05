import bcrypt from "bcrypt";
import User from "../models/User.js";
import jwt from "jsonwebtoken";
import crypto from "crypto";
import Session from "../models/Session.js";
import LoginAttempt from "../models/LoginAttempt.js";
import { sendEmail } from "../utils/emailService.js";

const ACCESS_TOKEN_TTL = "15m"; // thuờng là dưới 15m
const REFRESH_TOKEN_TTL = 14 * 24 * 60 * 60 * 1000; // 14 ngày
const LOGIN_ATTEMPT_POLICY = {
  1: {
    maxAttempts: 5,
    lockMs: 5 * 60 * 1000,
  },
  2: {
    maxAttempts: 3,
    lockMs: 30 * 60 * 1000,
  },
};

const normalizeLoginIdentifier = (value) =>
  typeof value === "string" ? value.trim().toLowerCase() : "";

const getClientIp = (req) => {
  const forwardedFor = req.headers["x-forwarded-for"];

  if (typeof forwardedFor === "string" && forwardedFor.trim()) {
    return forwardedFor.split(",")[0].trim();
  }

  return req.ip || req.socket?.remoteAddress || "unknown";
};

const buildLockMessage = (stage, retryAfterSeconds) => {
  const retryAfterMinutes = Math.max(1, Math.ceil(retryAfterSeconds / 60));

  if (stage === 1) {
    return `Bạn đã nhập sai quá 5 lần. Vui lòng thử lại sau ${retryAfterMinutes} phút.`;
  }

  return `Bạn đã nhập sai quá 3 lần sau thời gian mở khóa. Vui lòng thử lại sau ${retryAfterMinutes} phút.`;
};

const clearExpiredLockIfNeeded = async (attempt) => {
  if (!attempt?.lockedUntil || attempt.lockedUntil > new Date()) {
    return attempt;
  }

  if (attempt.stage === 1) {
    attempt.stage = 2;
  } else {
    attempt.stage = 1;
  }

  attempt.failureCount = 0;
  attempt.lockedUntil = null;
  attempt.lastFailedAt = null;
  await attempt.save();
  return attempt;
};

const getActiveLockPayload = (attempt) => {
  if (!attempt?.lockedUntil) {
    return null;
  }

  const retryAfterMs = attempt.lockedUntil.getTime() - Date.now();

  if (retryAfterMs <= 0) {
    return null;
  }

  const retryAfterSeconds = Math.ceil(retryAfterMs / 1000);
  return {
    retryAfterSeconds,
    lockedUntil: attempt.lockedUntil,
    message: buildLockMessage(attempt.stage, retryAfterSeconds),
  };
};

const registerFailedSignIn = async ({ identifier, ipAddress }) => {
  let attempt = await LoginAttempt.findOne({ identifier, ipAddress });
  attempt = await clearExpiredLockIfNeeded(attempt);

  if (!attempt) {
    attempt = await LoginAttempt.create({
      identifier,
      ipAddress,
      stage: 1,
      failureCount: 0,
    });
  }

  const stageConfig = LOGIN_ATTEMPT_POLICY[attempt.stage] || LOGIN_ATTEMPT_POLICY[1];
  attempt.failureCount += 1;
  attempt.lastFailedAt = new Date();

  if (attempt.failureCount >= stageConfig.maxAttempts) {
    attempt.lockedUntil = new Date(Date.now() + stageConfig.lockMs);
    await attempt.save();

    const retryAfterSeconds = Math.ceil(stageConfig.lockMs / 1000);
    return {
      status: 429,
      body: {
        message: buildLockMessage(attempt.stage, retryAfterSeconds),
        retryAfterSeconds,
        lockedUntil: attempt.lockedUntil,
      },
    };
  }

  await attempt.save();

  const remainingAttempts = stageConfig.maxAttempts - attempt.failureCount;
  const warningMessage = attempt.stage === 1
    ? `Bạn còn ${remainingAttempts} lần đăng nhập, vui lòng nhập đúng tài khoản và mật khẩu.`
    : `Bạn còn ${remainingAttempts} lần đăng nhập trước khi bị khóa 30 phút, vui lòng nhập đúng tài khoản và mật khẩu.`;

  return {
    status: 401,
    body: {
      message: warningMessage,
      remainingAttempts,
      stage: attempt.stage,
    },
  };
};

const clearSignInAttempts = async ({ identifier, ipAddress }) => {
  if (!identifier) {
    return;
  }

  await LoginAttempt.deleteOne({ identifier, ipAddress });
};

export const signUp = async (req, res) => {
  try {
    const { username, password, email, firstName, lastName } = req.body;

    if (!username || !password || !email || !firstName || !lastName) {
      return res.status(400).json({
        message: "Không thể thiếu username, password, email, firstName, và lastName",
      });
    }

    // kiểm tra username và email tồn tại chưa
    const usernameExists = await User.findOne({ username });
    if (usernameExists) {
      return res.status(409).json({ message: "username đã tồn tại" });
    }

    const emailExists = await User.findOne({ email });
    if (emailExists) {
      return res.status(409).json({ message: "email đã tồn tại" });
    }

    // mã hoá password
    const hashedPassword = await bcrypt.hash(password, 10); // salt = 10

    // tạo user mới (chưa verified)
    const otpCode = Math.floor(100000 + Math.random() * 900000).toString();
    const otpExpires = new Date(Date.now() + 10 * 60 * 1000); // 10 phút

    const user = await User.create({
      username,
      hashedPassword,
      email,
      displayName: `${lastName} ${firstName}`,
      isVerified: false,
      otp: otpCode,
      otpExpires,
    });

    // gửi OTP tới email (không chặn response)
    sendEmail({
      to: email,
      subject: "Mã xác thực đăng ký",
      text: `Mã xác thực của bạn: ${otpCode}. Mã có hiệu lực trong 10 phút.`,
    })
      .then(() => console.log("Signup OTP email dispatched"))
      .catch((e) => console.error("Gửi email OTP thất bại", e));

    return res.status(201).json({ message: "Đã gửi mã OTP tới email. Vui lòng xác thực để hoàn tất đăng ký." });
  } catch (error) {
    console.error("Lỗi khi gọi signUp", error);
    return res.status(500).json({ message: "Lỗi hệ thống" });
  }
}

export const signIn = async (req, res) => {
  try {
    // lấy inputs
    const { username, password } = req.body;
    const identifier = normalizeLoginIdentifier(username);
    const ipAddress = getClientIp(req);

    if (!username || !password) {
      return res.status(400).json({ message: "Thiếu username hoặc password." });
    }

    let existingAttempt = await LoginAttempt.findOne({ identifier, ipAddress });
    existingAttempt = await clearExpiredLockIfNeeded(existingAttempt);

    const activeLock = getActiveLockPayload(existingAttempt);
    if (activeLock) {
      return res.status(429).json(activeLock);
    }

    // lấy hashedPassword trong db để so với password input
    const user = await User.findOne({ username: identifier });

    if (!user) {
      const failedAttempt = await registerFailedSignIn({ identifier, ipAddress });
      return res.status(failedAttempt.status).json(failedAttempt.body);
    }

    // kiểm tra password
    const passwordCorrect = await bcrypt.compare(password, user.hashedPassword);

    if (!passwordCorrect) {
      const failedAttempt = await registerFailedSignIn({ identifier, ipAddress });
      return res.status(failedAttempt.status).json(failedAttempt.body);
    }

    await clearSignInAttempts({ identifier, ipAddress });

    // nếu khớp, tạo OTP và gửi qua email — chỉ cấp token sau khi xác thực OTP
    const otpCode = Math.floor(100000 + Math.random() * 900000).toString();
    const otpExpires = new Date(Date.now() + 10 * 60 * 1000); // 10 phút

    user.otp = otpCode;
    user.otpExpires = otpExpires;
    await user.save();

    // send email asynchronously so response is fast and frontend won't block
    sendEmail({
      to: user.email,
      subject: "Mã OTP đăng nhập",
      text: `Mã OTP đăng nhập của bạn: ${otpCode}. Mã có hiệu lực trong 10 phút.`,
    })
      .then(() => console.log("OTP email dispatched"))
      .catch((e) => console.error("Gửi email OTP thất bại", e));

    return res.status(200).json({ message: "Đã gửi mã OTP tới email. Vui lòng nhập OTP để hoàn tất đăng nhập.", userId: user._id, email: user.email });
  } catch (error) {
    console.error("Lỗi khi gọi signIn", error);
    return res.status(500).json({ message: "Lỗi hệ thống" });
  }
};

export const verifyOtp = async (req, res) => {
  try {
    const { email, otp } = req.body;

    if (!email || !otp) {
      return res.status(400).json({ message: "Cần cung cấp email và otp." });
    }

    const user = await User.findOne({ email });
    if (!user) return res.status(404).json({ message: "Người dùng không tồn tại." });

    if (!user.otp || !user.otpExpires) {
      return res.status(400).json({ message: "Không có mã OTP hợp lệ. Vui lòng thực hiện lại." });
    }

    if (user.otpExpires < new Date()) {
      return res.status(400).json({ message: "Mã OTP đã hết hạn." });
    }

    if (user.otp !== otp.toString()) {
      return res.status(400).json({ message: "Mã OTP không chính xác." });
    }

    // clear otp và mark verified
    user.otp = undefined;
    user.otpExpires = undefined;
    user.isVerified = true;
    await user.save();

    // cấp access và refresh token
    const accessToken = jwt.sign({ userId: user._id }, process.env.ACCESS_TOKEN_SECRET, { expiresIn: ACCESS_TOKEN_TTL });
    const refreshToken = crypto.randomBytes(64).toString("hex");

    await Session.create({ userId: user._id, refreshToken, expiresAt: new Date(Date.now() + REFRESH_TOKEN_TTL) });

    res.cookie("refreshToken", refreshToken, {
      httpOnly: true,
      secure: true,
      sameSite: "none",
      maxAge: REFRESH_TOKEN_TTL,
    });

    return res.status(200).json({ message: "Xác thực thành công", accessToken });
  } catch (error) {
    console.error("Lỗi verifyOtp", error);
    return res.status(500).json({ message: "Lỗi hệ thống" });
  }
};

export const forgotPassword = async (req, res) => {
  try {
    const { email } = req.body;
    if (!email) return res.status(400).json({ message: "Cần cung cấp email." });

    const user = await User.findOne({ email });
    if (!user) return res.status(200).json({ message: "Nếu email tồn tại, mã reset sẽ được gửi." });

    const resetOtp = Math.floor(100000 + Math.random() * 900000).toString();
    const resetOtpExpires = new Date(Date.now() + 10 * 60 * 1000);

    user.resetOtp = resetOtp;
    user.resetOtpExpires = resetOtpExpires;
    await user.save();

    try {
      await sendEmail({
        to: email,
        subject: "Mã đặt lại mật khẩu",
        text: `Mã đặt lại mật khẩu của bạn: ${resetOtp}. Mã có hiệu lực trong 10 phút.`,
      });
    } catch (e) {
      console.error("Gửi email reset OTP thất bại", e);
    }

    return res.status(200).json({ message: "Nếu email tồn tại, mã reset sẽ được gửi." });
  } catch (error) {
    console.error("Lỗi forgotPassword", error);
    return res.status(500).json({ message: "Lỗi hệ thống" });
  }
};

export const resetPassword = async (req, res) => {
  try {
    const { email, otp, newPassword } = req.body;
    if (!email || !otp || !newPassword) return res.status(400).json({ message: "Thiếu thông tin." });

    const user = await User.findOne({ email });
    if (!user) return res.status(404).json({ message: "Người dùng không tồn tại." });

    if (!user.resetOtp || !user.resetOtpExpires) return res.status(400).json({ message: "Không có mã reset hợp lệ." });

    if (user.resetOtpExpires < new Date()) return res.status(400).json({ message: "Mã reset đã hết hạn." });

    if (user.resetOtp !== otp.toString()) return res.status(400).json({ message: "Mã reset không chính xác." });

    const hashed = await bcrypt.hash(newPassword, 10);
    user.hashedPassword = hashed;
    user.resetOtp = undefined;
    user.resetOtpExpires = undefined;
    await user.save();

    return res.status(200).json({ message: "Đã đặt lại mật khẩu thành công." });
  } catch (error) {
    console.error("Lỗi resetPassword", error);
    return res.status(500).json({ message: "Lỗi hệ thống" });
  }
};

export const signOut = async (req, res) => {
  try {
    // lấy refresh token từ cookie
    const token = req.cookies?.refreshToken;

    if (token) {
      // xoá refresh token trong Session
      await Session.deleteOne({ refreshToken: token });

      // xoá cookie
      res.clearCookie("refreshToken");
    }

    return res.sendStatus(204);
  } catch (error) {
    console.error("Lỗi khi gọi signOut", error);
    return res.status(500).json({ message: "Lỗi hệ thống" });
  }
};

export const refreshToken = async (req, res) => {
  try {
    // lấy refresh token từ cookie
    const token = req.cookies?.refreshToken;
    if (!token) {
      return res.status(401).json({ message: "Token không tồn tại." });
    }

    // so với refresh token trong db
    const session = await Session.findOne({ refreshToken: token });

    if (!session) {
      return res.status(403).json({ message: "Token không hợp lệ hoặc đã hết hạn" });
    }

    // kiểm tra hết hạn chưa
    if (session.expiresAt < new Date()) {
      return res.status(403).json({ message: "Token đã hết hạn." });
    }

    // tạo access token mới
    const accessToken = jwt.sign(
      {
        userId: session.userId,
      },
      process.env.ACCESS_TOKEN_SECRET,
      { expiresIn: ACCESS_TOKEN_TTL }
    );

    // return
    return res.status(200).json({ accessToken });
  } catch (error) {
    console.error("Lỗi khi gọi refreshToken", error);
    return res.status(500).json({ message: "Lỗi hệ thống" });
  }
};