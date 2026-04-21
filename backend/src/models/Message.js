import mongoose from "mongoose";

const forwardedFromSchema = new mongoose.Schema({
    messageId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "Message",
        required: true,
    },
    conversationId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "Conversation",
        required: true,
    },
    senderId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "User",
        required: true,
    },
    content: {
        type: String,
        default: null,
    },
    imgUrls: {
        type: [String],
        default: [],
    },
    fileUrls: [
        {
            url: { type: String },
            name: { type: String },
            size: { type: Number },
            type: { type: String },
        },
    ],
    createdAt: {
        type: Date,
        required: true,
    },
}, { _id: false });

const callMetaSchema = new mongoose.Schema({
    callType: {
        type: String,
        enum: ["audio", "video"],
        required: true,
    },
    outcome: {
        type: String,
        enum: ["completed", "busy", "declined", "missed", "cancelled", "disconnected", "reconnect-timeout"],
        required: true,
    },
    callerId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "User",
        required: true,
    },
    recipientId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "User",
        required: true,
    },
    durationSeconds: {
        type: Number,
        default: 0,
    },
    startedAt: {
        type: Date,
        default: null,
    },
    endedAt: {
        type: Date,
        default: null,
    },
}, { _id: false });

const voiceMetaSchema = new mongoose.Schema({
    durationSeconds: {
        type: Number,
        default: 0,
    },
    mimeType: {
        type: String,
        default: null,
    },
}, { _id: false });

const replyToSchema = new mongoose.Schema({
    messageId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "Message",
        required: true,
    },
    senderId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "User",
        required: true,
    },
    content: {
        type: String,
        default: null,
    },
    messageType: {
        type: String,
        enum: ["text", "call", "voice"],
        default: "text",
    },
    imgUrls: {
        type: [String],
        default: [],
    },
    fileUrls: [
        {
            url: { type: String },
            name: { type: String },
            size: { type: Number },
            type: { type: String },
        },
    ],
    createdAt: {
        type: Date,
        required: true,
    },
}, { _id: false });

const messageSchema = new mongoose.Schema({
    conversationId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "Conversation",
        required: true,
        index: true
    },
    senderId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "User",
        required: true

    },
    content: {
        type: String,
        required: false
    },
    messageType: {
        type: String,
        enum: ["text", "call", "voice"],
        default: "text",
    },
    callMeta: {
        type: callMetaSchema,
        default: null,
    },
    voiceMeta: {
        type: voiceMetaSchema,
        default: null,
    },

    imgUrls: {
        type: [String],
        default: [],
    },
    fileUrls: [
        {
            url: { type: String },
            name: { type: String },
            size: { type: Number },
            type: { type: String },
        },
    ],

    isPinned: {
        type: Boolean,
        default: false
    },
    pinnedBy: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "User"
    },
    pinnedAt: {
        type: Date
    },
    isRecalled: {
        type: Boolean,
        default: false
    },
    recalledAt: {
        type: Date
    },
    reactions: {
        type: Map,
        of: [
            {
                type: mongoose.Schema.Types.ObjectId,
                ref: "User"
            }
        ],
        default: {}
    },
    recallBy: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "User"
    },
    forwardedFrom: {
        type: forwardedFromSchema,
        default: null,
    },
    replyTo: {
        type: replyToSchema,
        default: null,
    },
    deletedForUsers: [{
        type: mongoose.Schema.Types.ObjectId,
        ref: "User"
    }]

}, { timestamps: true }


);

messageSchema.index({ conversationId: 1, createdAt: -1 });
const Message = mongoose.models.Message || mongoose.model("Message", messageSchema);

export default Message;
