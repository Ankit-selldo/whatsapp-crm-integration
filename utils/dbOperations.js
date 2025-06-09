const { Chat, Message } = require('../models/Chat');

// Get all chats
async function getAllChats() {
    try {
        return await Chat.find().sort({ updatedAt: -1 });
    } catch (error) {
        throw new Error(`Error fetching chats: ${error.message}`);
    }
}

// Get chat by ID
async function getChatById(chatId) {
    try {
        const chat = await Chat.findOne({ chatId });
        if (!chat) return null;
        
        // Get recent messages
        const messages = await Message.find({ chatId })
            .sort({ timestamp: -1 })
            .limit(50);
            
        return {
            ...chat.toObject(),
            messages
        };
    } catch (error) {
        throw new Error(`Error fetching chat: ${error.message}`);
    }
}

// Get chat messages
async function getChatMessages(chatId, limit = 50) {
    try {
        return await Message.find({ chatId })
            .sort({ timestamp: -1 })
            .limit(limit);
    } catch (error) {
        throw new Error(`Error fetching messages: ${error.message}`);
    }
}

// Search messages
async function searchMessages(searchTerm) {
    try {
        const regex = new RegExp(searchTerm, 'i');
        const messages = await Message.find({
            body: regex
        }).sort({ timestamp: -1 });
        
        // Group messages by chat
        const chatIds = [...new Set(messages.map(m => m.chatId))];
        const chats = await Chat.find({ chatId: { $in: chatIds } });
        
        return chats.map(chat => ({
            ...chat.toObject(),
            messages: messages.filter(m => m.chatId === chat.chatId)
        }));
    } catch (error) {
        throw new Error(`Error searching messages: ${error.message}`);
    }
}

// Get group chats
async function getGroupChats() {
    try {
        return await Chat.find({ isGroup: true }).sort({ updatedAt: -1 });
    } catch (error) {
        throw new Error(`Error fetching group chats: ${error.message}`);
    }
}

// Get private chats
async function getPrivateChats() {
    try {
        return await Chat.find({ isGroup: false }).sort({ updatedAt: -1 });
    } catch (error) {
        throw new Error(`Error fetching private chats: ${error.message}`);
    }
}

// Get recent chats
async function getRecentChats() {
    try {
        const oneDayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);
        return await Chat.find({
            updatedAt: { $gte: oneDayAgo }
        }).sort({ updatedAt: -1 });
    } catch (error) {
        throw new Error(`Error fetching recent chats: ${error.message}`);
    }
}

// Get media messages
async function getMediaMessages(type = null, limit = 50) {
    try {
        const query = type ? { mediaType: type } : { mediaType: { $exists: true } };
        const messages = await Message.find(query)
            .sort({ timestamp: -1 })
            .limit(limit);
            
        // Get chat details for these messages
        const chatIds = [...new Set(messages.map(m => m.chatId))];
        const chats = await Chat.find({ chatId: { $in: chatIds } });
        const chatMap = new Map(chats.map(c => [c.chatId, c]));
        
        return messages.map(message => ({
            chatId: message.chatId,
            chatName: chatMap.get(message.chatId)?.name || 'Unknown',
            message: message.toObject()
        }));
    } catch (error) {
        throw new Error(`Error fetching media messages: ${error.message}`);
    }
}

// Delete chat
async function deleteChat(chatId) {
    try {
        // Delete all messages first
        await Message.deleteMany({ chatId });
        // Then delete the chat
        const result = await Chat.deleteOne({ chatId });
        return result.deletedCount > 0;
    } catch (error) {
        throw new Error(`Error deleting chat: ${error.message}`);
    }
}

// Save chat to database
async function saveChatToDatabase(chat) {
    try {
        const chatData = {
            chatId: chat.id._serialized,
            name: chat.name,
            isGroup: chat.isGroup,
            participants: chat.participants ? chat.participants.map(p => p.id._serialized) : [],
            unreadCount: chat.unreadCount || 0,
            isArchived: chat.archived || false,
            isPinned: chat.pinned || false,
            metadata: {
                description: chat.description || '',
                createdAt: new Date(),
                createdBy: chat.createdBy ? chat.createdBy.id._serialized : null
            }
        };

        await Chat.findOneAndUpdate(
            { chatId: chatData.chatId },
            chatData,
            { upsert: true, new: true }
        );
    } catch (error) {
        console.error('Error saving chat:', error);
    }
}

// Save message to database
async function saveMessageToDatabase(messageData) {
    try {
        const { Message } = require('../models/Chat');
        
        // Check if message already exists
        const existingMessage = await Message.findOne({ messageId: messageData.messageId });
        if (existingMessage) {
            console.log('Message already exists:', messageData.messageId);
            return existingMessage;
        }
        
        // Create new message document
        const message = new Message(messageData);
        await message.save();
        
        // Update chat metadata
        const { Chat } = require('../models/Chat');
        await Chat.findOneAndUpdate(
            { chatId: messageData.chatId },
            { 
                $inc: { 
                    'metadata.messageCount': 1,
                    'metadata.mediaCount': messageData.mediaUrl ? 1 : 0
                },
                updatedAt: new Date()
            }
        );
        
        return message;
    } catch (error) {
        console.error('Error saving message:', error);
        throw error;
    }
}

module.exports = {
    getAllChats,
    getChatById,
    getChatMessages,
    searchMessages,
    getGroupChats,
    getPrivateChats,
    getRecentChats,
    getMediaMessages,
    deleteChat,
    saveChatToDatabase,
    saveMessageToDatabase
}; 