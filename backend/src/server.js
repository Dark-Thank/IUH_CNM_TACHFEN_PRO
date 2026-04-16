import dotenv from "dotenv";
import cookieParser from "cookie-parser";
import cors from "cors";
import express from "express";
import fs from "fs";
import swaggerUi from "swagger-ui-express";
import { v2 as cloudinary } from "cloudinary";
import { app, initializeSocketInfrastructure, server } from "./socket/index.js";
import { connectDB } from "./libs/db.js";
import { protectedRoute } from "./middlewares/authMiddleware.js";
import authRoute from "./routes/authRoute.js";
import conversationRoute from "./routes/conversationRoute.js";
import friendRoute from "./routes/friendRoute.js";
import messageRoute from "./routes/messageRoute.js";
import userRoute from "./routes/userRoute.js";

dotenv.config();

const PORT = process.env.PORT || 5001;

app.use(cors({
  origin: "http://localhost:5173",
  methods: ["GET", "POST", "PUT", "DELETE", "PATCH"],
  credentials: true,
}));

app.use(cookieParser());
app.use(cors({ origin: process.env.CLIENT_URL, credentials: true }));
app.use(express.json());

cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
});

const swaggerDocument = JSON.parse(fs.readFileSync("./src/swagger.json", "utf-8"));
app.use("/api-docs", swaggerUi.serve, swaggerUi.setup(swaggerDocument));

app.use("/api/auth", authRoute);

app.use(protectedRoute);
app.use("/api/users", userRoute);
app.use("/api/friends", friendRoute);
app.use("/api/messages", messageRoute);
app.use("/api/conversations", conversationRoute);

const bootstrapServer = async () => {
  try {
    await connectDB();
    await initializeSocketInfrastructure();

    server.listen(PORT, "0.0.0.0", () => {
      console.log(`server bat dau tren cong ${PORT}`);
    });
  } catch (error) {
    console.error("Khong the khoi dong server:", error);
    process.exit(1);
  }
};

bootstrapServer();
