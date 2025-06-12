const express = require('express');
const http = require('http');
const socketIo = require('socket.io');
const cors = require('cors');
const multer = require('multer');
const path = require('path');
const { v4: uuidv4 } = require('uuid');
const fs = require('fs');

const app = express();

// Middleware
app.use(cors());
app.use(express.json());
app.use('/uploads', express.static('uploads'));

// Create uploads directory if it doesn't exist
if (!fs.existsSync('uploads')) {
  fs.mkdirSync('uploads');
}

// Configure multer for file uploads
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, 'uploads/');
  },
  filename: (req, file, cb) => {
    const uniqueName = `${uuidv4()}${path.extname(file.originalname)}`;
    cb(null, uniqueName);
  }
});

const upload = multer({ 
  storage,
  limits: {
    fileSize: 5 * 1024 * 1024 // 5MB limit
  }
});

// Store connected users with their Firebase UID as key
const connectedUsers = new Map();
// Store all registered users
const allUsers = new Map();
// Store all messages
const messages = new Map();

// API Routes
const apiRouter = express.Router();

// User registration endpoint
apiRouter.post('/users/register', (req, res) => {
  console.log('Registering user:', req.body);
  const { uid, email } = req.body;
  if (!uid || !email) {
    return res.status(400).json({ error: 'Missing required fields' });
  }

  allUsers.set(uid, { uid, email, online: false });
  res.json({ success: true });
});

// Get all users endpoint
apiRouter.get('/users', (req, res) => {
  console.log('Fetching users');
  const users = Array.from(allUsers.values()).map(user => ({
    uid: user.uid,
    email: user.email,
    online: connectedUsers.has(user.uid)
  }));
  res.json(users);
});

// File upload endpoint
apiRouter.post('/upload', upload.single('file'), (req, res) => {
  if (!req.file) {
    return res.status(400).json({ error: 'No file uploaded' });
  }

  const fileUrl = `http://localhost:5001/uploads/${req.file.filename}`;
  res.json({ url: fileUrl });
});

// Mount API routes
app.use('/api', apiRouter);

const server = http.createServer(app);
const io = socketIo(server, {
  cors: {
    origin: "http://localhost:3000",
    methods: ["GET", "POST"]
  }
});

io.on('connection', (socket) => {
  console.log('New client connected:', socket.id);

  // Handle user login
  socket.on('login', (userData) => {
    console.log('User logged in:', userData);
    
    if (!allUsers.has(userData.uid)) {
      allUsers.set(userData.uid, {
        uid: userData.uid,
        email: userData.email,
        online: true
      });
    }
    
    // Store user data with Firebase UID as key
    connectedUsers.set(userData.uid, {
      socketId: socket.id,
      userId: userData.uid,
      email: userData.email,
      online: true
    });

    socket.userId = userData.uid; // Store userId in socket for easy access

    // Broadcast updated users list to all clients
    broadcastUsers();
  });

  // Handle messages
  socket.on('sendMessage', (data) => {
    console.log('Message received:', data);
    
    // Find recipient's socket ID using their Firebase UID
    const recipient = connectedUsers.get(data.to);

    if (recipient) {
      const messageData = {
        id: uuidv4(),
        content: data.message,
        sender: socket.userId,
        recipient: data.to,
        fileUrl: data.fileUrl,
        fileName: data.fileName,
        fileType: data.fileType,
        timestamp: Date.now(),
        status: 'sent'
      };

      messages.set(messageData.id, messageData);

      // Send to recipient
      io.to(recipient.socketId).emit('message', messageData);
      // Send confirmation back to sender
      socket.emit('message', messageData);
    }
  });

  // Handle typing status
  socket.on('typing', (data) => {
    const recipient = connectedUsers.get(data.to);
    if (recipient) {
      io.to(recipient.socketId).emit('userTyping', {
        userId: socket.userId,
        isTyping: data.isTyping
      });
    }
  });

  // Handle message status updates
  socket.on('messageDelivered', (messageId) => {
    const message = messages.get(messageId);
    if (message) {
      const sender = connectedUsers.get(message.sender);
      if (sender) {
        io.to(sender.socketId).emit('messageStatus', {
          messageId,
          status: 'delivered'
        });
        message.status = 'delivered';
        messages.set(messageId, message);
      }
    }
  });

  // Handle disconnection
  socket.on('disconnect', () => {
    console.log('Client disconnected:', socket.id);
    
    if (socket.userId) {
      // Remove from connected users
      connectedUsers.delete(socket.userId);
      // Update online status in allUsers
      const user = allUsers.get(socket.userId);
      if (user) {
        user.online = false;
      }
      // Broadcast updated users list
      broadcastUsers();
    }
  });
});

// Function to broadcast updated users list
function broadcastUsers() {
  const usersList = Array.from(allUsers.values()).map(user => ({
    uid: user.uid,
    email: user.email,
    online: connectedUsers.has(user.uid)
  }));
  
  console.log('Broadcasting users list:', usersList);
  io.emit('users', usersList);
}

const PORT = process.env.PORT || 5001;
server.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
