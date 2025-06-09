
// Get all chats
db.chats.find()

// Get group chats
db.chats.find({ isGroup: true })

// Search messages
db.chats.find({ 'messages.body': { $regex: 'search term', $options: 'i' } })

// Get recent chats
db.chats.find({
    lastUpdated: { 
        $gte: new Date(Date.now() - 24 * 60 * 60 * 1000)
    }
})