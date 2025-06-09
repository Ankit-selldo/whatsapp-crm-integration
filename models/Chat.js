const mongoose = require('mongoose');

const messageSchema = new mongoose.Schema({
    messageId: {
        type: String,
        required: true,
        unique: true,
        index: true
    },
    chatId: {
        type: String,
        required: true,
        index: true
    },
    body: {
        type: String
    },
    timestamp: {
        type: Date,
        required: true,
        index: true
    },
    from: {
        type: String,
        required: true
    },
    to: {
        type: String,
        required: true
    },
    senderName: {
        type: String,
        index: true
    },
    senderNumber: {
        type: String,
        index: true
    },
    type: {
        type: String,
        enum: ['text', 'image', 'video', 'audio', 'document', 'location', 'contact', 'sticker', 'chat'],
        default: 'text'
    },
    isForwarded: {
        type: Boolean,
        default: false
    },
    isReply: {
        type: Boolean,
        default: false
    },
    replyTo: {
        type: String,
        ref: 'Message'
    },
    mediaUrl: String,
    mediaType: String,
    mediaSize: Number,
    location: {
        latitude: Number,
        longitude: Number,
        name: String
    },
    contact: {
        name: String,
        number: String
    }
}, {
    timestamps: true
});

// Add compound indexes for common queries
messageSchema.index({ chatId: 1, timestamp: -1 });
messageSchema.index({ from: 1, timestamp: -1 });
messageSchema.index({ type: 1, timestamp: -1 });

const chatSchema = new mongoose.Schema({
    chatId: {
        type: String,
        required: true,
        unique: true,
        index: true
    },
    name: {
        type: String,
        index: true
    },
    isGroup: {
        type: Boolean,
        default: false,
        index: true
    },
    participants: [{
        type: String,
        index: true
    }],
    unreadCount: {
        type: Number,
        default: 0
    },
    isArchived: {
        type: Boolean,
        default: false
    },
    isPinned: {
        type: Boolean,
        default: false
    },
    metadata: {
        description: String,
        createdAt: Date,
        createdBy: String,
        messageCount: {
            type: Number,
            default: 0
        },
        mediaCount: {
            type: Number,
            default: 0
        }
    }
}, {
    timestamps: true
});

// Indexes for common queries
chatSchema.index({ updatedAt: -1 });

// Method to update metadata
chatSchema.methods.updateMetadata = async function() {
    const Message = mongoose.model('Message');
    const messageCount = await Message.countDocuments({ chatId: this.chatId });
    const mediaCount = await Message.countDocuments({ 
        chatId: this.chatId,
        type: { $ne: 'text' }
    });
    
    this.metadata.messageCount = messageCount;
    this.metadata.mediaCount = mediaCount;
};

// Pre-save middleware to update metadata
chatSchema.pre('save', async function(next) {
    await this.updateMetadata();
    next();
});

module.exports = {
    Chat: mongoose.model('Chat', chatSchema),
    Message: mongoose.model('Message', messageSchema)
}; 