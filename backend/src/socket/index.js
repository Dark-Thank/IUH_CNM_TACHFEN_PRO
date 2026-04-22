import { createAdapter } from "@socket.io/redis-adapter";
import dotenv from "dotenv";
import express from "express";
import http from "http";
import { createClient } from "redis";
import { Server } from "socket.io";
import { getUserConversationsForSocketIO } from "../controllers/conversationController.js";
import { socketAuthMiddleware } from "../middlewares/socketAuthMiddleware.js";
import Conversation from "../models/Conversation.js";
import Message from "../models/Message.js";
import { buildCorsOptions } from "../utils/cors.js";
import { emitNewMessage, updateConversationAfterCreateMessage } from "../utils/messageHelper.js";
import { formatMessageForClient } from "../utils/messageHelper.js";

dotenv.config();

const app = express();
const server = http.createServer(app);
const io = new Server(server, {
    cors: buildCorsOptions(),
});

const REDIS_URL = process.env.REDIS_URL?.trim();
let socketInfrastructureReady = false;
const REDIS_CONNECT_TIMEOUT_MS = 5000;
const EMPTY_SOCKET_LIST = [];
const CALL_RING_TIMEOUT_MS = 30_000;
const CALL_RECONNECT_TIMEOUT_MS = 20_000;
const activeCalls = new Map();
const callTimeouts = new Map();
const userCallIndex = new Map();
const pendingUserEvents = new Map();

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

const trackTypingConversation = (socket, conversationId, shouldTrack) => {
    const trackedConversationIds = socket.data.typingConversationIds || new Set();

    if (shouldTrack) {
        trackedConversationIds.add(conversationId);
    } else {
        trackedConversationIds.delete(conversationId);
    }

    socket.data.typingConversationIds = trackedConversationIds;
};

const emitTypingUpdate = (socket, conversationId, isTyping) => {
    if (typeof conversationId !== "string" || !conversationId || !socket.rooms.has(conversationId)) {
        return;
    }

    trackTypingConversation(socket, conversationId, isTyping);

    socket.to(conversationId).emit("typing:update", {
        conversationId,
        userId: socket.data.userId,
        displayName: socket.user?.displayName || "",
        isTyping,
    });
};

const getConnectedSockets = () => Array.from(io.of("/")?.sockets?.values?.() || EMPTY_SOCKET_LIST);

const isValidCallType = (callType) => callType === "audio" || callType === "video";

const getCallMessageOutcome = (reason, activeCall) => {
    if (reason === "busy") {
        return "busy";
    }

    if (reason === "declined") {
        return "declined";
    }

    if (reason === "missed") {
        return "missed";
    }

    if (reason === "cancelled") {
        return "cancelled";
    }

    if (reason === "disconnected") {
        return "disconnected";
    }

    if (reason === "reconnect-timeout") {
        return "reconnect-timeout";
    }

    if (reason === "ended" && activeCall?.startedAt) {
        return "completed";
    }

    return activeCall?.startedAt ? "completed" : "cancelled";
};

const getCallPreviewContent = (callType, outcome) => {
    const typeLabel = callType === "video" ? "Cuoc goi video" : "Cuoc goi thoai";

    switch (outcome) {
        case "busy":
            return "Nguoi nhan ban";
        case "declined":
            return `${typeLabel} bi tu choi`;
        case "missed":
            return `${typeLabel} nho`;
        case "cancelled":
            return `${typeLabel} da huy`;
        case "disconnected":
            return `${typeLabel} bi gian doan`;
        case "reconnect-timeout":
            return `${typeLabel} mat ket noi`;
        default:
            return typeLabel;
    }
};

const normalizeCallPayload = (payload = {}) => ({
    callId: typeof payload.callId === "string" ? payload.callId.trim() : "",
    conversationId:
        typeof payload.conversationId === "string" ? payload.conversationId.trim() : "",
    targetId: typeof payload.targetId === "string" ? payload.targetId.trim() : "",
    recipientId: typeof payload.recipientId === "string" ? payload.recipientId.trim() : "",
    callType: typeof payload.callType === "string" ? payload.callType.trim() : "",
    description: payload.description,
    candidate: payload.candidate,
    reason: typeof payload.reason === "string" ? payload.reason.trim() : undefined,
});

const clearCallTimeout = (callId) => {
    const timeout = callTimeouts.get(callId);

    if (timeout) {
        clearTimeout(timeout);
        callTimeouts.delete(callId);
    }
};

const enqueuePendingUserEvent = (userId, eventName, payload) => {
    const queuedEvents = pendingUserEvents.get(userId) ?? [];
    queuedEvents.push({ eventName, payload });
    pendingUserEvents.set(userId, queuedEvents);
};

const emitToUser = (userId, eventName, payload) => {
    const room = io.sockets.adapter.rooms.get(userId);

    if (room?.size) {
        io.to(userId).emit(eventName, payload);
        return;
    }

    enqueuePendingUserEvent(userId, eventName, payload);
};

const flushPendingUserEvents = (userId) => {
    const queuedEvents = pendingUserEvents.get(userId);

    if (!queuedEvents?.length) {
        return;
    }

    queuedEvents.forEach(({ eventName, payload }) => {
        io.to(userId).emit(eventName, payload);
    });

    pendingUserEvents.delete(userId);
};

const persistCallSummaryMessage = async (activeCall, reason) => {
    if (!activeCall?.conversationId || !activeCall?.callerId || !activeCall?.recipientId || !isValidCallType(activeCall.callType)) {
        return;
    }

    const conversation = await Conversation.findById(activeCall.conversationId);

    if (!conversation) {
        return;
    }

    const outcome = getCallMessageOutcome(reason, activeCall);
    const endedAt = new Date();
    const durationSeconds = activeCall.startedAt
        ? Math.max(0, Math.floor((endedAt.getTime() - new Date(activeCall.startedAt).getTime()) / 1000))
        : 0;

    const message = await Message.create({
        conversationId: activeCall.conversationId,
        senderId: activeCall.callerId,
        content: getCallPreviewContent(activeCall.callType, outcome),
        messageType: "call",
        callMeta: {
            callType: activeCall.callType,
            outcome,
            callerId: activeCall.callerId,
            recipientId: activeCall.recipientId,
            durationSeconds,
            startedAt: activeCall.startedAt ?? null,
            endedAt,
        },
    });

    updateConversationAfterCreateMessage(conversation, message, activeCall.callerId);
    await conversation.save();

    const formattedMessage = await formatMessageForClient(message);

    emitNewMessage(io, conversation, formattedMessage);
};

const clearCallState = (callId) => {
    const activeCall = activeCalls.get(callId);

    clearCallTimeout(callId);

    if (!activeCall) {
        return null;
    }

    userCallIndex.delete(activeCall.callerId);
    userCallIndex.delete(activeCall.recipientId);
    activeCalls.delete(callId);

    return activeCall;
};

const emitCallEnd = ({ callId, conversationId, senderId, targetId, reason }) => {
    emitToUser(targetId, "call:end", {
        callId,
        conversationId,
        senderId,
        targetId,
        reason,
    });
};

const emitCallState = (activeCall, state, affectedUserId) => {
    const payload = {
        callId: activeCall.callId,
        conversationId: activeCall.conversationId,
        state,
        affectedUserId,
    };

    emitToUser(activeCall.callerId, "call:state", payload);
    emitToUser(activeCall.recipientId, "call:state", payload);
};

const scheduleMissedCall = (callId) => {
    clearCallTimeout(callId);

    const timeout = setTimeout(() => {
        const activeCall = clearCallState(callId);

        if (!activeCall) {
            return;
        }

        void persistCallSummaryMessage(activeCall, "missed");

        emitToUser(activeCall.callerId, "call:decline", {
            callId,
            conversationId: activeCall.conversationId,
            senderId: activeCall.recipientId,
            targetId: activeCall.callerId,
            reason: "missed",
        });

        emitToUser(activeCall.recipientId, "call:end", {
            callId,
            conversationId: activeCall.conversationId,
            senderId: activeCall.callerId,
            targetId: activeCall.recipientId,
            reason: "missed",
        });
    }, CALL_RING_TIMEOUT_MS);

    callTimeouts.set(callId, timeout);
};

const scheduleReconnectTimeout = (callId, disconnectedUserId) => {
    clearCallTimeout(callId);

    const timeout = setTimeout(() => {
        const activeCall = clearCallState(callId);

        if (!activeCall) {
            return;
        }

        void persistCallSummaryMessage(activeCall, "reconnect-timeout");

        emitToUser(activeCall.callerId, "call:end", {
            callId,
            conversationId: activeCall.conversationId,
            senderId: disconnectedUserId,
            targetId: activeCall.callerId,
            reason: "reconnect-timeout",
        });

        emitToUser(activeCall.recipientId, "call:end", {
            callId,
            conversationId: activeCall.conversationId,
            senderId: disconnectedUserId,
            targetId: activeCall.recipientId,
            reason: "reconnect-timeout",
        });
    }, CALL_RECONNECT_TIMEOUT_MS);

    callTimeouts.set(callId, timeout);
};

const findActiveCallByUserId = (userId) => {
    const callId = userCallIndex.get(userId);
    return callId ? activeCalls.get(callId) ?? null : null;
};

const getDirectConversationParticipantIds = async (conversationId) => {
    const conversation = await Conversation.findById(conversationId)
        .select("type participants")
        .lean();

    if (!conversation || conversation.type !== "direct") {
        return null;
    }

    return conversation.participants.map((participant) => participant.userId.toString());
};

const broadcastOnlineUsers = async () => {
    try {
        const sockets = getConnectedSockets();
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

    socket.on("typing:start", ({ conversationId } = {}) => {
        emitTypingUpdate(socket, conversationId, true);
    });

    socket.on("typing:stop", ({ conversationId } = {}) => {
        emitTypingUpdate(socket, conversationId, false);
    });

    socket.on("call:invite", async (payload) => {
        const { callId, conversationId, recipientId, callType } = normalizeCallPayload(payload);

        if (!callId || !conversationId || !recipientId || !isValidCallType(callType)) {
            return;
        }

        try {
            const participantIds = await getDirectConversationParticipantIds(conversationId);

            if (
                !participantIds ||
                participantIds.length !== 2 ||
                !participantIds.includes(userId) ||
                !participantIds.includes(recipientId)
            ) {
                return;
            }

            if (userCallIndex.has(userId)) {
                emitToUser(userId, "call:decline", {
                    callId,
                    conversationId,
                    senderId: userId,
                    targetId: recipientId,
                    reason: "busy",
                });
                return;
            }

            if (userCallIndex.has(recipientId)) {
                await persistCallSummaryMessage({
                    conversationId,
                    callerId: userId,
                    recipientId,
                    callType,
                }, "busy");

                emitToUser(userId, "call:decline", {
                    callId,
                    conversationId,
                    senderId: recipientId,
                    targetId: userId,
                    reason: "busy",
                });
                return;
            }

            activeCalls.set(callId, {
                callId,
                conversationId,
                callerId: userId,
                recipientId,
                callType,
                state: "ringing",
            });
            userCallIndex.set(userId, callId);
            userCallIndex.set(recipientId, callId);

            emitToUser(recipientId, "call:invite", {
                callId,
                conversationId,
                callerId: userId,
                recipientId,
                callType,
                createdAt: new Date().toISOString(),
            });

            scheduleMissedCall(callId);
        } catch (error) {
            console.error("Khong the khoi tao cuoc goi:", error);
        }
    });

    socket.on("call:accept", (payload) => {
        const { callId, conversationId, targetId } = normalizeCallPayload(payload);
        const activeCall = activeCalls.get(callId);

        if (
            !activeCall ||
            activeCall.conversationId !== conversationId ||
            activeCall.callerId !== targetId ||
            activeCall.recipientId !== userId
        ) {
            return;
        }

        clearCallTimeout(callId);
        activeCall.state = "connecting";
        activeCall.startedAt = new Date().toISOString();

        emitToUser(targetId, "call:accept", {
            callId,
            conversationId,
            callerId: activeCall.callerId,
            recipientId: activeCall.recipientId,
            callType: activeCall.callType,
        });
    });

    socket.on("call:decline", (payload) => {
        const { callId, conversationId, targetId, reason } = normalizeCallPayload(payload);
        const activeCall = clearCallState(callId);

        if (!activeCall || activeCall.conversationId !== conversationId) {
            return;
        }

        void persistCallSummaryMessage(activeCall, reason || "declined");

        emitToUser(targetId, "call:decline", {
            callId,
            conversationId,
            senderId: userId,
            targetId,
            reason: reason || "declined",
        });
    });

    socket.on("call:end", (payload) => {
        const { callId, conversationId, targetId, reason } = normalizeCallPayload(payload);
        const activeCall = clearCallState(callId);

        if (!activeCall || activeCall.conversationId !== conversationId) {
            return;
        }

        void persistCallSummaryMessage(activeCall, reason || "ended");

        emitCallEnd({
            callId,
            conversationId,
            senderId: userId,
            targetId,
            reason: reason || "ended",
        });
    });

    socket.on("call:offer", (payload) => {
        const { callId, conversationId, targetId, description } = normalizeCallPayload(payload);
        const activeCall = activeCalls.get(callId);

        if (!activeCall || !description || activeCall.conversationId !== conversationId) {
            return;
        }

        emitToUser(targetId, "call:offer", {
            callId,
            conversationId,
            senderId: userId,
            targetId,
            description,
        });
    });

    socket.on("call:answer", (payload) => {
        const { callId, conversationId, targetId, description } = normalizeCallPayload(payload);
        const activeCall = activeCalls.get(callId);

        if (!activeCall || !description || activeCall.conversationId !== conversationId) {
            return;
        }

        emitToUser(targetId, "call:answer", {
            callId,
            conversationId,
            senderId: userId,
            targetId,
            description,
        });
    });

    socket.on("call:ice-candidate", (payload) => {
        const { callId, conversationId, targetId, candidate } = normalizeCallPayload(payload);
        const activeCall = activeCalls.get(callId);

        if (!activeCall || !candidate || activeCall.conversationId !== conversationId) {
            return;
        }

        emitToUser(targetId, "call:ice-candidate", {
            callId,
            conversationId,
            senderId: userId,
            targetId,
            candidate,
        });
    });

    socket.join(userId);
    flushPendingUserEvents(userId);

    const activeCall = findActiveCallByUserId(userId);

    if (activeCall && activeCall.state === "reconnecting" && activeCall.disconnectedUserId === userId) {
        clearCallTimeout(activeCall.callId);
        activeCall.state = "connected";
        delete activeCall.disconnectedUserId;
        emitCallState(activeCall, "connected", userId);
    }

    await broadcastOnlineUsers();

    socket.on("disconnect", () => {
        const typingConversationIds = socket.data.typingConversationIds || new Set();

        typingConversationIds.forEach((conversationId) => {
            socket.to(conversationId).emit("typing:update", {
                conversationId,
                userId,
                displayName: user.displayName || "",
                isTyping: false,
            });
        });
        console.log(`socket disconnected: ${socket.id}`);

        const remainingSockets = getConnectedSockets().filter((connectedSocket) => (
            connectedSocket.id !== socket.id && getSocketUserId(connectedSocket) === userId
        ));

        if (remainingSockets.length > 0) {
            return;
        }

        const activeCall = findActiveCallByUserId(userId);

        if (activeCall) {
            const targetId = activeCall.callerId === userId ? activeCall.recipientId : activeCall.callerId;

            if (activeCall.state === "ringing") {
                clearCallState(activeCall.callId);
                void persistCallSummaryMessage(activeCall, "disconnected");
                emitCallEnd({
                    callId: activeCall.callId,
                    conversationId: activeCall.conversationId,
                    senderId: userId,
                    targetId,
                    reason: "disconnected",
                });
            } else {
                activeCall.state = "reconnecting";
                activeCall.disconnectedUserId = userId;
                emitCallState(activeCall, "reconnecting", userId);
                scheduleReconnectTimeout(activeCall.callId, userId);
            }
        }

        broadcastOnlineUsers().catch((error) => {
            console.error("Khong the cap nhat online-users khi disconnect:", error);
        });
    });
});

export { app, io, server };

