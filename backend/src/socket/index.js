import dotenv from "dotenv";
import express from "express";
import http from "http";
import { createAdapter } from "@socket.io/redis-adapter";
import { createClient } from "redis";
import { Server } from "socket.io";
import { getUserConversationsForSocketIO } from "../controllers/conversationController.js";
import { socketAuthMiddleware } from "../middlewares/socketAuthMiddleware.js";
import { buildCorsOptions } from "../utils/cors.js";

dotenv.config();

const app = express();
const server = http.createServer(app);
const io = new Server(server, {
    cors: buildCorsOptions(),
});

const REDIS_URL = process.env.REDIS_URL?.trim();
let socketInfrastructureReady = false;
const REDIS_CONNECT_TIMEOUT_MS = 5000;

const withTimeout = (promise, timeoutMs, label) =>
    Promise.race([
        promise,
        new Promise((_, reject) => {
            setTimeout(() => {
                reject(new Error(`${label} timed out after ${timeoutMs}ms`));
            }, timeoutMs);
        }),
    ]);

const closeRedisClientSafely = (client) => {
    if (!client?.isOpen) {
        return;
    }

    client.destroy();
};

const getSocketUserId = (socket) => {
    const dataUserId = socket?.data?.userId;

    if (typeof dataUserId === "string" && dataUserId) {
        return dataUserId;
    }

    const authUserId = socket?.user?._id;
    return authUserId ? authUserId.toString() : null;
};

const broadcastOnlineUsers = async () => {
    try {
        const sockets = await io.fetchSockets();
        const onlineUserIds = Array.from(
            new Set(
                sockets
                    .map(getSocketUserId)
                    .filter(Boolean)
            )
        );

        io.emit("online-users", onlineUserIds);
    } catch (error) {
        console.error("Khong the dong bo online-users:", error);
    }
};

export const initializeSocketInfrastructure = async () => {
    if (socketInfrastructureReady) {
        return;
    }

    if (!REDIS_URL) {
        socketInfrastructureReady = true;
        console.log("Socket.IO Redis adapter is disabled");
        return;
    }

    const pubClient = createClient({
        url: REDIS_URL,
        socket: {
            connectTimeout: REDIS_CONNECT_TIMEOUT_MS,
            reconnectStrategy: false,
        },
    });
    const subClient = pubClient.duplicate();

    try {
        await withTimeout(
            Promise.all([pubClient.connect(), subClient.connect()]),
            REDIS_CONNECT_TIMEOUT_MS,
            "Socket.IO Redis adapter"
        );
        io.adapter(createAdapter(pubClient, subClient));
        socketInfrastructureReady = true;
        console.log("Socket.IO Redis adapter is enabled");
    } catch (error) {
        socketInfrastructureReady = true;
        console.warn(
            "Socket.IO Redis adapter is unavailable, continuing in single-instance mode:",
            error.message
        );

        closeRedisClientSafely(pubClient);
        closeRedisClientSafely(subClient);
    }
};

io.use(socketAuthMiddleware);

io.on("connection", async (socket) => {
    const user = socket.user;
    const userId = user._id.toString();

    socket.data.userId = userId;
    console.log(`${user.displayName} online voi socket ${socket.id}`);

    const conversationIds = await getUserConversationsForSocketIO(userId);
    conversationIds.forEach((id) => {
        socket.join(id);
    });

    socket.on("join-conversation", (conversationId) => {
        socket.join(conversationId);
    });

    socket.join(userId);
    await broadcastOnlineUsers();

    socket.on("disconnect", () => {
        console.log(`socket disconnected: ${socket.id}`);
        broadcastOnlineUsers().catch((error) => {
            console.error("Khong the cap nhat online-users khi disconnect:", error);
        });
    });
});

export { app, io, server };
