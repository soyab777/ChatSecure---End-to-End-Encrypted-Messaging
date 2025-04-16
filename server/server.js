const express = require('express');
const http = require('http');
const socketIo = require('socket.io');
const cors = require('cors');

const app = express();
app.use(cors());

const server = http.createServer(app);
const io = socketIo(server, {
  cors: {
    origin: "http://localhost:3000",
    methods: ["GET", "POST"]
  }
});

// Store connected users with their Firebase UID as key
const connectedUsers = new Map();

io.on('connection', (socket) => {
  console.log('New client connected:', socket.id);

  // Handle user connection with Firebase UID and email
  socket.on('user-connected', (userData) => {
    console.log('User connected with data:', userData);
    
    // Store user data with Firebase UID as key
    connectedUsers.set(userData.userId, {
      socketId: socket.id,
      userId: userData.userId,
      email: userData.email,
      online: true
    });

    socket.userId = userData.userId; // Store userId in socket for easy access

    // Broadcast updated users list to all clients
    broadcastUsers();
  });

  // Handle private messages
  socket.on('private-message', (data) => {
    console.log('Private message:', data);
    
    // Find recipient's socket ID using their Firebase UID
    const recipient = connectedUsers.get(data.recipient);

    if (recipient) {
      // Send to recipient
      io.to(recipient.socketId).emit('private-message', {
        content: data.content,
        encryptedContent: data.encryptedContent,
        sender: data.sender,
        timestamp: data.timestamp
      });
    }
  });

  // Handle disconnection
  socket.on('disconnect', () => {
    console.log('Client disconnected:', socket.id);
    
    if (socket.userId) {
      // Remove user using their Firebase UID
      connectedUsers.delete(socket.userId);
      // Broadcast updated users list
      broadcastUsers();
    }
  });
});

// Function to broadcast updated users list
function broadcastUsers() {
  const usersList = Array.from(connectedUsers.values()).map(user => ({
    id: user.userId,
    email: user.email,
    online: user.online
  }));
  
  console.log('Broadcasting users list:', usersList);
  io.emit('users', usersList);
}

const PORT = process.env.PORT || 5001;
server.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
