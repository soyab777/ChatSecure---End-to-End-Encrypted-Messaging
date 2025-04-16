const express = require('express');
const http = require('http');
const socketIo = require('socket.io');
const cors = require('cors');
const mongoose = require('mongoose');
const dotenv = require('dotenv');
const crypto = require('crypto');
const Message = require('./models/Message');
const User = require('./models/User');

dotenv.config();
const app = express();
const server = http.createServer(app);
const io = socketIo(server, {
  cors: {
    origin: ["http://localhost:3000", "http://localhost:3001"],
    methods: ["GET", "POST"]
  }
});

// Middleware
app.use(cors({
  origin: ["http://localhost:3000", "http://localhost:3001"],
  methods: ['GET', 'POST', 'PUT', 'DELETE'],
  credentials: true
}));
app.use(express.json());

// MongoDB connection
mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/chat-secure', {
  useNewUrlParser: true,
  useUnifiedTopology: true
})
  .then(() => console.log('Connected to MongoDB'))
  .catch(err => console.error('MongoDB connection error:', err));

// Online users store
const onlineUsers = new Map();

// Socket.IO connection handling
io.on('connection', (socket) => {
  console.log('New client connected');

  socket.on('login', async (userId) => {
    try {
      socket.userId = userId;
      onlineUsers.set(userId, socket.id);
      io.emit('userStatus', { userId, status: 'online' });
      console.log(`User ${userId} logged in`);

      // Deliver any pending messages
      const undeliveredMessages = await Message.getUndeliveredMessages(userId);
      if (undeliveredMessages.length > 0) {
        const messagePromises = undeliveredMessages.map(async (msg) => {
          msg.status = 'delivered';
          msg.deliveredAt = new Date();
          await msg.save();
          socket.emit('message', {
            id: msg._id,
            sender: msg.sender,
            content: msg.content,
            timestamp: msg.timestamp,
            status: msg.status
          });
        });
        await Promise.all(messagePromises);
      }
    } catch (error) {
      console.error('Error in login:', error);
      socket.emit('error', { message: 'Login failed' });
    }
  });

  socket.on('sendMessage', async ({ to, message, groupId }) => {
    try {
      const messageData = {
        sender: socket.userId,
        content: message,
        timestamp: new Date(),
        status: 'sent'
      };

      // Create and save message to database
      const newMessage = new Message({
        sender: socket.userId,
        recipient: groupId || to,
        content: message,
        groupId: groupId || null,
        status: 'sent'
      });

      await newMessage.save();
      messageData.id = newMessage._id;

      // Handle both private and group messages
      if (groupId) {
        messageData.groupId = groupId;
        io.to(groupId).emit('message', messageData);
        console.log(`Group message sent to ${groupId}`);
      } else {
        const recipientSocket = onlineUsers.get(to);
        if (recipientSocket) {
          io.to(recipientSocket).emit('message', messageData);
          // Update message status to delivered
          newMessage.status = 'delivered';
          newMessage.deliveredAt = new Date();
          await newMessage.save();
        }
        // Send to sender for chat history
        socket.emit('message', messageData);
        console.log(`Private message sent from ${socket.userId} to ${to}`);
      }
    } catch (error) {
      console.error('Error sending message:', error);
      socket.emit('error', { message: 'Failed to send message' });
    }
  });

  socket.on('deleteMessage', async ({ messageId }) => {
    try {
      const message = await Message.findById(messageId);
      if (!message) {
        return socket.emit('error', { message: 'Message not found' });
      }

      // Check if user has permission to delete
      if (message.sender !== socket.userId && message.recipient !== socket.userId) {
        return socket.emit('error', { message: 'Unauthorized to delete message' });
      }

      await message.softDelete(socket.userId);
      
      // Notify all relevant parties about deletion
      const recipientSocket = onlineUsers.get(message.recipient);
      if (recipientSocket) {
        io.to(recipientSocket).emit('messageDeleted', { messageId });
      }
      socket.emit('messageDeleted', { messageId });
      
      console.log(`Message ${messageId} deleted by ${socket.userId}`);
    } catch (error) {
      console.error('Error deleting message:', error);
      socket.emit('error', { message: 'Failed to delete message' });
    }
  });

  socket.on('markAsRead', async ({ messageId }) => {
    try {
      const message = await Message.findById(messageId);
      if (message && message.recipient === socket.userId) {
        message.status = 'read';
        message.readAt = new Date();
        await message.save();
        
        // Notify sender that message was read
        const senderSocket = onlineUsers.get(message.sender);
        if (senderSocket) {
          io.to(senderSocket).emit('messageRead', { messageId, readAt: message.readAt });
        }
      }
    } catch (error) {
      console.error('Error marking message as read:', error);
    }
  });

  socket.on('typing', ({ to, isTyping }) => {
    const recipientSocket = onlineUsers.get(to);
    if (recipientSocket) {
      io.to(recipientSocket).emit('userTyping', {
        userId: socket.userId,
        isTyping
      });
    }
  });

  socket.on('disconnect', () => {
    if (socket.userId) {
      onlineUsers.delete(socket.userId);
      io.emit('userStatus', { userId: socket.userId, status: 'offline' });
      console.log(`User ${socket.userId} disconnected`);
    }
    console.log('Client disconnected');
  });
});

// API Routes
app.get('/api/messages/history/:userId', async (req, res) => {
  try {
    const { userId } = req.params;
    const { limit = 50, skip = 0 } = req.query;
    const currentUser = req.user.id; // Assuming authentication middleware sets this

    const messages = await Message.getChatHistory(currentUser, userId, parseInt(limit), parseInt(skip));
    res.json(messages);
  } catch (error) {
    console.error('Error fetching chat history:', error);
    res.status(500).json({ error: 'Failed to fetch chat history' });
  }
});

// Basic health check endpoint
app.get('/health', (req, res) => {
  res.status(200).json({ status: 'ok' });
});

// Error handling middleware
app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(500).json({ error: 'Something broke!' });
});

const PORT = process.env.PORT || 5001;
server.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
