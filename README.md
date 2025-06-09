# WhatsApp CRM Integration

A Node.js application that integrates WhatsApp with CRM systems using whatsapp-web.js. This application allows you to:
- Connect WhatsApp Web
- Send and receive messages
- Store chat history
- Handle media messages
- Search through messages
- Manage group chats

## Features

- WhatsApp Web integration using whatsapp-web.js
- MongoDB database for message storage
- RESTful API endpoints
- Media file handling
- Real-time message updates
- Chat history management
- Message search functionality
- Group chat support

## Prerequisites

- Node.js (v14 or higher)
- MongoDB
- Chrome/Chromium browser (for WhatsApp Web)

## Installation

1. Clone the repository:
```bash
git clone https://github.com/yourusername/whatsapp-crm-integration.git
cd whatsapp-crm-integration
```

2. Install dependencies:
```bash
npm install
```

3. Create a `.env` file in the root directory:
```env
MONGODB_URI=mongodb://localhost:27017/whatsapp_crm
PORT=3000
NODE_ENV=development
WHATSAPP_SESSION_PATH=.wwebjs_auth
WHATSAPP_CLIENT_ID=whatsapp-client
UPLOAD_DIR=uploads
MAX_FILE_SIZE=10485760
LOG_LEVEL=debug
```

4. Start the application:
```bash
# Development mode
npm run dev

# Production mode
npm start
```

## API Endpoints

### WhatsApp Integration
- `GET /api/whatsapp/status` - Check connection status
- `GET /api/whatsapp/qr` - Get QR code for authentication
- `POST /api/whatsapp/send` - Send text message
- `POST /api/whatsapp/send-media` - Send media message
- `GET /api/whatsapp/chats` - Get all chats
- `GET /api/whatsapp/chats/:chatId` - Get specific chat
- `GET /api/whatsapp/search` - Search messages
- `GET /api/whatsapp/recent` - Get recent chats
- `GET /api/whatsapp/media` - Get media messages
- `DELETE /api/whatsapp/chats/:chatId` - Delete chat

## Project Structure
```
├── api/               # API endpoints
│   └── whatsapp.js   # WhatsApp integration
├── models/           # Database models
│   └── Chat.js      # Chat and Message schemas
├── utils/           # Utility functions
│   └── dbOperations.js # Database operations
├── uploads/         # Media storage
├── app.js          # Main application file
└── package.json    # Project configuration
```

## Contributing

1. Fork the repository
2. Create your feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add some amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

## License

This project is licensed under the MIT License - see the LICENSE file for details.

## Acknowledgments

- [whatsapp-web.js](https://github.com/pedroslopez/whatsapp-web.js) for WhatsApp Web integration
- [Express.js](https://expressjs.com/) for the web framework
- [MongoDB](https://www.mongodb.com/) for the database 