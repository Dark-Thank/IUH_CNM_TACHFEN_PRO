import mongoose from "mongoose";

const loginAttemptSchema = new mongoose.Schema(
  {
    identifier: {
      type: String,
      required: true,
      trim: true,
      lowercase: true,
    },
    ipAddress: {
      type: String,
      required: true,
      trim: true,
    },
    stage: {
      type: Number,
      enum: [1, 2],
      default: 1,
    },
    failureCount: {
      type: Number,
      default: 0,
      min: 0,
    },
    lockedUntil: {
      type: Date,
      default: null,
    },
    lastFailedAt: {
      type: Date,
      default: null,
    },
  },
  {
    timestamps: true,
  }
);

loginAttemptSchema.index({ identifier: 1, ipAddress: 1 }, { unique: true });

const LoginAttempt = mongoose.model("LoginAttempt", loginAttemptSchema);

export default LoginAttempt;