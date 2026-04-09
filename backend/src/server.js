import cookieParser from "cookie-parser";
import cors from "cors";
import dotenv from "dotenv";
import express from "express";
import fs from "fs";
import swaggerUi from "swagger-ui-express";
import { connectDB } from "./libs/db.js";
import { protectedRoute } from "./middlewares/authMiddleware.js";
import authRoute from "./routes/authRoute.js";
import conversationRoute from "./routes/conversationRoute.js";
import friendRoute from "./routes/friendRoute.js";
import messageRoute from "./routes/messageRoute.js";
import userRoute from "./routes/userRoute.js";
import { app, server } from "./socket/index.js";

dotenv.config();

// const app = express();
const PORT = process.env.PORT || 5001;

// Cấu hình CORS
app.use(cors({
  origin: 'http://localhost:5173', // Chỉ cho phép FE của bạn truy cập
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH'],
  credentials: true // Cho phép gửi cookie/token nếu cần
}));

// middlewares 
app.use(express.json());
app.use(cookieParser());
app.use(cors({ origin: process.env.CLIENT_URL, credentials: true }));

//swagger
const swaggerDocument = JSON.parse(fs.readFileSync('./src/swagger.json', 'utf-8'));
app.use('/api-docs', swaggerUi.serve, swaggerUi.setup(swaggerDocument));

// public routes
app.use("/api/auth", authRoute);

// // private routes
app.use(protectedRoute);
app.use("/api/users", userRoute);
app.use('/api/friends', friendRoute);
app.use('/api/messages', messageRoute);
app.use('/api/conversations', conversationRoute);

connectDB().then(() => {
  server.listen(PORT, () => {
    console.log(`server bắt đầu trên cổng ${PORT}`);
  });
});


