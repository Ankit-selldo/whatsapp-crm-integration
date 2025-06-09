const express = require('express');
const router = express.Router();
const { Client, LocalAuth, MessageMedia } = require('whatsapp-web.js');
const { Chat, Message } = require('../models/Chat');
const dbOps = require('../utils/dbOperations');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const qrcode = require('qrcode-terminal');

// Configure multer for file uploads
const storage = multer.diskStorage({
    destination: (req, file, cb) => {
        const dir = path.join(__dirname, '..', 'uploads', 'media');
        if (!fs.existsSync(dir)) {
            fs.mkdirSync(dir, { recursive: true });
        }
        cb(null, dir);
    },
    filename: (req, file, cb) => {
        cb(null, Date.now() + path.extname(file.originalname));
    }
});

const upload = multer({
    storage,
    limits: { fileSize: 10 * 1024 * 1024 }, // 10MB limit
    fileFilter: (req, file, cb) => {
        const allowedTypes = ['image/jpeg', 'image/png', 'image/gif', 'video/mp4', 'audio/mpeg', 'application/pdf'];
        if (allowedTypes.includes(file.mimetype)) {
            cb(null, true);
        } else {
            cb(new Error('Invalid file type'));
        }
    }
});

// Initialize WhatsApp client
const client = new Client({
    authStrategy: new LocalAuth({
        clientId: process.env.WHATSAPP_CLIENT_ID || 'whatsapp-client',
        dataPath: process.env.WHATSAPP_SESSION_PATH || '.wwebjs_auth'
    }),
    puppeteer: {
        args: [
            '--no-sandbox',
            '--disable-setuid-sandbox',
            '--disable-dev-shm-usage',
            '--disable-accelerated-2d-canvas',
            '--no-first-run',
            '--no-zygote',
            '--disable-gpu',
            '--disable-extensions',
            '--disable-default-apps',
            '--disable-translate',
            '--disable-sync',
            '--disable-background-networking',
            '--metrics-recording-only',
            '--mute-audio',
            '--no-default-browser-check',
            '--safebrowsing-disable-auto-update',
            '--js-flags=--max-old-space-size=512'
        ],
        headless: true,
        executablePath: process.env.CHROME_PATH || undefined
    }
});

// Store QR code for frontend
let qrCode = null;

// Generate QR Code
client.on('qr', (qr) => {
    qrCode = qr;
    // Display QR in terminal
    console.log('\n=== WhatsApp QR Code ===');
    qrcode.generate(qr, { small: true });
    console.log('Please scan this QR code with your WhatsApp mobile app\n');
});

// When client is ready
client.on('ready', () => {
    console.log('\n=== WhatsApp client is ready! ===');
    console.log('Client info:', client.info);
    qrCode = null;
});

// Handle new messages
client.on('message', async (message) => {
    try {
        // Get chat info
        const chat = await message.getChat();
        const contact = await message.getContact();
        
        console.log('\n=== New Message ===');
        console.log('From:', contact.pushname || contact.number || message.from);
        console.log('Chat:', chat.name || chat.id._serialized);
        console.log('Type:', message.type);
        console.log('Body:', message.body || '(No text content)');
        console.log('Timestamp:', new Date(message.timestamp * 1000).toLocaleString());
        if (message.isForwarded) {
            console.log('(Forwarded Message)');
        }
        console.log('==================\n');

        // Save chat to database
        await dbOps.saveChatToDatabase(chat);

        // Prepare message data
        const messageData = {
            messageId: message.id._serialized,
            chatId: chat.id._serialized,
            body: message.body || '',
            timestamp: new Date(message.timestamp * 1000),
            from: contact.pushname || contact.number || message.from,
            to: message.to,
            type: message.type,
            isForwarded: message.isForwarded,
            isReply: message.hasQuotedMsg,
            replyTo: message.hasQuotedMsg ? message.quotedMsgId : null,
            senderName: contact.pushname || contact.number,
            senderNumber: contact.number
        };

        // Handle media messages
        if (message.hasMedia) {
            try {
                const media = await message.downloadMedia();
                if (media) {
                    const mediaDir = path.join(__dirname, '..', 'uploads', 'media');
                    if (!fs.existsSync(mediaDir)) {
                        fs.mkdirSync(mediaDir, { recursive: true });
                    }
                    
                    const mediaPath = path.join(mediaDir, `${Date.now()}-${message.id._serialized}`);
                    fs.writeFileSync(mediaPath, media.data, 'base64');
                    
                    messageData.mediaUrl = mediaPath;
                    messageData.mediaType = media.mimetype;
                    messageData.mediaSize = media.data.length;
                }
            } catch (error) {
                console.error('Error saving media:', error);
            }
        }

        // Save message to database
        await dbOps.saveMessageToDatabase(messageData);
    } catch (error) {
        console.error('Error handling new message:', error);
    }
});

// Handle authentication failure
client.on('auth_failure', (error) => {
    console.error('\n=== WhatsApp Authentication Failed ===');
    console.error('Error:', error);
    qrCode = null;
});

// Handle disconnection
client.on('disconnected', (reason) => {
    console.log('\n=== WhatsApp Client Disconnected ===');
    console.log('Reason:', reason);
    qrCode = null;
});

// Initialize the client
client.initialize().catch(err => {
    console.error('\n=== Failed to initialize WhatsApp client ===');
    console.error('Error:', err);
});

// API Endpoints

// Get QR code for authentication
router.get('/qr', (req, res) => {
    if (qrCode) {
        res.json({ qr: qrCode });
    } else if (client.info) {
        res.json({ status: 'connected' });
    } else {
        res.json({ status: 'waiting' });
    }
});

// Get connection status
router.get('/status', (req, res) => {
    res.json({
        status: client.info ? 'connected' : 'disconnected',
        info: client.info || null
    });
});

// Send text message
router.post('/send', async (req, res) => {
    try {
        const { to, message } = req.body;
        if (!to || !message) {
            return res.status(400).json({ error: 'Missing required fields' });
        }

        const response = await client.sendMessage(to, message);
        res.json({ success: true, messageId: response.id._serialized });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// Send media message
router.post('/send-media', upload.single('media'), async (req, res) => {
    try {
        const { to, caption } = req.body;
        const file = req.file;

        if (!to || !file) {
            return res.status(400).json({ error: 'Missing required fields' });
        }

        const media = MessageMedia.fromFilePath(file.path);
        const response = await client.sendMessage(to, media, { caption });

        // Clean up uploaded file
        fs.unlinkSync(file.path);

        res.json({ success: true, messageId: response.id._serialized });
    } catch (error) {
        if (req.file) {
            fs.unlinkSync(req.file.path);
        }
        res.status(500).json({ error: error.message });
    }
});

// Get all chats
router.get('/chats', async (req, res) => {
    try {
        const chats = await dbOps.getAllChats();
        res.json(chats);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// Get chat by ID
router.get('/chats/:chatId', async (req, res) => {
    try {
        const chat = await dbOps.getChatById(req.params.chatId);
        if (!chat) {
            return res.status(404).json({ error: 'Chat not found' });
        }
        res.json(chat);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// Search messages
router.get('/search', async (req, res) => {
    try {
        const { query } = req.query;
        if (!query) {
            return res.status(400).json({ error: 'Search query required' });
        }
        const results = await dbOps.searchMessages(query);
        res.json(results);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// Get recent chats
router.get('/recent', async (req, res) => {
    try {
        const recent = await dbOps.getRecentChats();
        res.json(recent);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// Get media messages
router.get('/media', async (req, res) => {
    try {
        const { type, limit = 50 } = req.query;
        const mediaTypes = ['image', 'video', 'audio', 'document'];
        
        if (type && !mediaTypes.includes(type)) {
            return res.status(400).json({ error: 'Invalid media type' });
        }

        const mediaMessages = await dbOps.getMediaMessages(type, limit);
        res.json(mediaMessages);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// Delete chat
router.delete('/chats/:chatId', async (req, res) => {
    try {
        const result = await dbOps.deleteChat(req.params.chatId);
        if (!result) {
            return res.status(404).json({ error: 'Chat not found' });
        }
        res.json({ success: true });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

module.exports = router; 