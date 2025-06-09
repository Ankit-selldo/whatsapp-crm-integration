const Chat = require('../models/Chat');
const fs = require('fs');
const path = require('path');

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
        return await Chat.findOne({ chatId });
    } catch (error) {
        throw new Error(`Error fetching chat: ${error.message}`);
    }
}

// Get chat messages
async function getChatMessages(chatId, limit = 50) {
    try {
        const chat = await Chat.findOne({ chatId });
        if (!chat) return null;
        return chat.messages.slice(-limit);
    } catch (error) {
        throw new Error(`Error fetching messages: ${error.message}`);
    }
}

// Search messages
async function searchMessages(searchTerm) {
    try {
        const regex = new RegExp(searchTerm, 'i');
        return await Chat.find({
            'messages.body': regex
        });
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
        const query = type ? { 'messages.mediaType': type } : { 'messages.mediaType': { $exists: true } };
        const chats = await Chat.find(query)
            .select('chatId name messages')
            .sort({ 'messages.timestamp': -1 })
            .limit(limit);

        const mediaMessages = [];
        chats.forEach(chat => {
            chat.messages.forEach(message => {
                if (message.mediaType) {
                    mediaMessages.push({
                        chatId: chat.chatId,
                        chatName: chat.name,
                        message: message
                    });
                }
            });
        });

        return mediaMessages.slice(0, limit);
    } catch (error) {
        throw new Error(`Error fetching media messages: ${error.message}`);
    }
}

// Delete chat
async function deleteChat(chatId) {
    try {
        const result = await Chat.deleteOne({ chatId });
        return result.deletedCount > 0;
    } catch (error) {
        throw new Error(`Error deleting chat: ${error.message}`);
    }
}

// Save chat to database
async function saveChatToDatabase(chat) {
    try {
        console.log('Attempting to save chat:', {
            chatId: chat.id._serialized,
            name: chat.name,
            isGroup: chat.isGroup
        });

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

        console.log('Chat data prepared:', chatData);

        const result = await Chat.findOneAndUpdate(
            { chatId: chatData.chatId },
            chatData,
            { upsert: true, new: true }
        );
        
        if (!result) {
            console.error('Failed to save chat - no result returned');
            throw new Error('Failed to save chat to database');
        }
        
        console.log(`Chat saved successfully: ${chatData.name} (ID: ${result._id})`);
        return result;
    } catch (error) {
        console.error('Error saving chat:', error);
        console.error('Error details:', {
            name: error.name,
            message: error.message,
            stack: error.stack
        });
        throw error;
    }
}

// Save message to database
async function saveMessageToDatabase(chatId, message) {
    try {
        console.log('Attempting to save message:', {
            chatId,
            messageId: message.id._serialized,
            type: message.type
        });

        let mediaData = null;
        if (message.hasMedia) {
            try {
                console.log('Downloading media for message:', message.id._serialized);
                const media = await message.downloadMedia();
                
                // Create media directory if it doesn't exist
                const mediaDir = path.join(__dirname, '../uploads/media');
                if (!fs.existsSync(mediaDir)) {
                    fs.mkdirSync(mediaDir, { recursive: true });
                }

                // Generate unique filename
                const filename = `${Date.now()}-${message.id._serialized}${path.extname(media.filename || '.bin')}`;
                const filepath = path.join(mediaDir, filename);

                // Save media file
                fs.writeFileSync(filepath, media.data);
                console.log('Media saved to:', filepath);

                mediaData = {
                    mediaUrl: `/uploads/media/${filename}`,
                    mediaType: message.type,
                    mediaSize: media.data.length
                };
            } catch (mediaError) {
                console.error('Error downloading media:', mediaError);
                console.error('Media error details:', {
                    name: mediaError.name,
                    message: mediaError.message,
                    stack: mediaError.stack
                });
            }
        }

        const messageData = {
            messageId: message.id._serialized,
            from: message.from,
            to: message.to,
            timestamp: new Date(message.timestamp * 1000),
            type: message.type,
            body: message.body,
            isForwarded: message.isForwarded,
            isReply: message.hasQuotedMsg,
            replyTo: message.quotedMsgId,
            ...(mediaData || {}),
            location: message.location,
            contact: message.contact
        };

        console.log('Message data prepared:', messageData);

        const result = await Chat.findOneAndUpdate(
            { chatId },
            { 
                $push: { messages: messageData },
                $set: { updatedAt: new Date() }
            },
            { new: true }
        );

        if (!result) {
            console.error('Failed to save message - no result returned');
            throw new Error('Failed to save message to database');
        }

        console.log(`Message saved successfully: ${messageData.messageId} (Chat: ${result._id})`);
        return result;
    } catch (error) {
        console.error('Error saving message:', error);
        console.error('Error details:', {
            name: error.name,
            message: error.message,
            stack: error.stack
        });
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