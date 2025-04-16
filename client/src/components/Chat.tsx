import React, { useEffect, useState, useRef } from 'react';
import { Box, TextField, Button, Paper, Typography, Avatar, IconButton, List, ListItemButton, ListItemText, ListItemAvatar } from '@mui/material';
import { Send as SendIcon, Delete as DeleteIcon } from '@mui/icons-material';
import { useAuth } from '../contexts/AuthContext';
import io, { Socket } from 'socket.io-client';
import axios from 'axios';
import { useNavigate } from 'react-router-dom';

interface Message {
  id: string;
  sender: string;
  recipient: string;
  content: string;
  timestamp: number;
  status: 'sent' | 'delivered' | 'read' | 'deleted';
}

interface User {
  uid: string;
  email: string;
  online: boolean;
}

const Chat: React.FC = () => {
  const { currentUser } = useAuth();
  const navigate = useNavigate();
  const [socket, setSocket] = useState<Socket | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [messageInput, setMessageInput] = useState('');
  const [users, setUsers] = useState<User[]>([]);
  const [selectedUser, setSelectedUser] = useState<User | null>(null);
  const [isTyping, setIsTyping] = useState(false);
  const [typingTimeout, setTypingTimeout] = useState<NodeJS.Timeout | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const storedUser = localStorage.getItem('user');
    if (!storedUser) {
      navigate('/login');
      return;
    }

    const user = JSON.parse(storedUser);
    const newSocket = io('http://localhost:5001');
    setSocket(newSocket);

    // Emit login event with user ID
    newSocket.emit('login', user.uid);

    // Listen for user status updates
    newSocket.on('userStatus', ({ userId, status }) => {
      setUsers(prevUsers => 
        prevUsers.map(u => 
          u.uid === userId ? { ...u, online: status === 'online' } : u
        )
      );
    });

    newSocket.on('message', (message: Message) => {
      if (message.sender === selectedUser?.uid || message.recipient === user.uid) {
        setMessages(prev => [...prev, message]);
        scrollToBottom();
      }
      
      // Mark message as delivered if we're the recipient
      if (message.recipient === user.uid && message.status === 'sent') {
        newSocket.emit('messageDelivered', message.id);
      }
    });

    // Fetch users list
    fetch('http://localhost:5001/users')
      .then(res => res.json())
      .then(data => setUsers(data))
      .catch(err => console.error('Error fetching users:', err));

    return () => {
      newSocket.close();
    };
  }, [navigate]);

  useEffect(() => {
    // Fetch chat history when selecting a user
    const fetchChatHistory = async () => {
      if (selectedUser) {
        try {
          const response = await axios.get(
            `${process.env.REACT_APP_API_URL}/api/messages/history/${selectedUser.uid}`
          );
          setMessages(response.data);
          scrollToBottom();
        } catch (error) {
          console.error('Error fetching chat history:', error);
        }
      }
    };
    fetchChatHistory();
  }, [selectedUser]);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  const handleSendMessage = () => {
    if (!socket || !messageInput.trim() || !selectedUser) return;

    socket.emit('sendMessage', {
      to: selectedUser.uid,
      message: messageInput.trim()
    });

    setMessageInput('');
  };

  const handleDeleteMessage = (messageId: string) => {
    if (!socket) return;
    socket.emit('deleteMessage', { messageId });
  };

  const handleTyping = () => {
    if (!socket || !selectedUser) return;

    socket.emit('typing', { to: selectedUser.uid, isTyping: true });

    if (typingTimeout) {
      clearTimeout(typingTimeout);
    }

    const timeout = setTimeout(() => {
      socket.emit('typing', { to: selectedUser.uid, isTyping: false });
    }, 2000);

    setTypingTimeout(timeout);
  };

  return (
    <Box sx={{ display: 'flex', height: '100vh', p: 2 }}>
      {/* Users List */}
      <Paper sx={{ width: 300, mr: 2, overflow: 'auto' }}>
        <List>
          {users.map(user => (
            <ListItemButton
              key={user.uid}
              selected={selectedUser?.uid === user.uid}
              onClick={() => setSelectedUser(user)}
            >
              <ListItemAvatar>
                <Avatar>{user.email[0].toUpperCase()}</Avatar>
              </ListItemAvatar>
              <ListItemText
                primary={user.email}
                secondary={user.online ? 'Online' : 'Offline'}
              />
            </ListItemButton>
          ))}
        </List>
      </Paper>

      {/* Chat Area */}
      <Box sx={{ flex: 1, display: 'flex', flexDirection: 'column' }}>
        <Paper sx={{ flex: 1, mb: 2, p: 2, overflow: 'auto' }}>
          {selectedUser ? (
            <>
              {messages.map((message, index) => (
                <Box
                  key={index}
                  sx={{
                    display: 'flex',
                    justifyContent: message.sender === currentUser?.uid ? 'flex-end' : 'flex-start',
                    mb: 1
                  }}
                >
                  <Paper
                    sx={{
                      p: 1,
                      backgroundColor: message.sender === currentUser?.uid ? '#e3f2fd' : '#f5f5f5',
                      maxWidth: '70%'
                    }}
                  >
                    <Typography variant="body1">{message.content}</Typography>
                    <Typography variant="caption" color="textSecondary">
                      {new Date(message.timestamp).toLocaleTimeString()}
                      {message.sender === currentUser?.uid && (
                        <IconButton
                          size="small"
                          onClick={() => handleDeleteMessage(message.id)}
                        >
                          <DeleteIcon fontSize="small" />
                        </IconButton>
                      )}
                    </Typography>
                  </Paper>
                </Box>
              ))}
              {isTyping && (
                <Typography variant="caption" color="textSecondary">
                  {selectedUser.email} is typing...
                </Typography>
              )}
              <div ref={messagesEndRef} />
            </>
          ) : (
            <Typography variant="h6" align="center">
              Select a user to start chatting
            </Typography>
          )}
        </Paper>

        {selectedUser && (
          <Box sx={{ display: 'flex', gap: 1 }}>
            <TextField
              fullWidth
              variant="outlined"
              placeholder="Type a message..."
              value={messageInput}
              onChange={(e) => setMessageInput(e.target.value)}
              onKeyPress={(e) => {
                if (e.key === 'Enter') handleSendMessage();
                handleTyping();
              }}
            />
            <Button
              variant="contained"
              color="primary"
              endIcon={<SendIcon />}
              onClick={handleSendMessage}
            >
              Send
            </Button>
          </Box>
        )}
      </Box>
    </Box>
  );
};

export default Chat;
