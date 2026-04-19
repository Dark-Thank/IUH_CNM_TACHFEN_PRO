import mongoose from "mongoose";

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
    recallBy: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "User"
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
