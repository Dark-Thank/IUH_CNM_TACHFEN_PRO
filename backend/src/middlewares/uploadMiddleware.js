import multer from "multer";
import path from "path";
import { randomUUID } from "crypto";
import { v2 as cloudinary } from "cloudinary";
cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
});

export const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 1024 * 1024 * 10,
  },
});

const sanitizeFileName = (value = "file") =>
  value
    .normalize("NFKD")
    .replace(/[^a-zA-Z0-9-_]/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 80) || "file";

export const uploadFileFromBuffer = (buffer, options = {}) => {
  const {
    originalName,
    mimeType,
    folder = "moji_chat/files",
    ...restOptions
  } = options;

  const parsedName = path.parse(originalName || "file");
  const sanitizedBaseName = sanitizeFileName(parsedName.name);
  const extension = parsedName.ext.replace(/^\./, "").toLowerCase();
  const publicId = `${Date.now()}-${randomUUID().slice(0, 8)}-${sanitizedBaseName}`;

  return new Promise((resolve, reject) => {
    const uploadStream = cloudinary.uploader.upload_stream(
      {
        folder,
        resource_type: "raw",
        public_id: publicId,
        display_name: originalName || parsedName.base,
        filename_override: originalName || parsedName.base,
        format: extension || undefined,
        use_filename: false,
        unique_filename: false,
        overwrite: false,
        invalidate: false,
        context: mimeType ? `mime_type=${mimeType}|original_filename=${originalName || parsedName.base}` : undefined,
        ...restOptions,
      },
      (error, result) => {
        if (error) reject(error);
        else resolve(result);
      }
    );

    uploadStream.end(buffer);
  });
};
export const uploadImageFromBuffer = (buffer, options) => {
  return new Promise((resolve, reject) => {
    const uploadStream = cloudinary.uploader.upload_stream(
      {
        folder: "moji_chat/avatars",
        resource_type: "image",
        transformation: [{ width: 200, height: 200, crop: "fill" }],
        ...options,
      },
      (error, result) => {
        if (error) {
          reject(error);
        } else {
          resolve(result);
        }
      }
    );

    uploadStream.end(buffer);
  });
};
