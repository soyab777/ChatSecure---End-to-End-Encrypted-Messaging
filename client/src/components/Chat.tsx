import React, { useEffect, useState, useRef } from 'react';
import { 
  Box, 
  TextField, 
  Button, 
  Paper, 
  Typography, 
  Avatar, 
  IconButton, 
  List, 
  ListItemButton, 
  ListItemText, 
  ListItemAvatar,
  Tooltip,
  CircularProgress,
  Alert
} from '@mui/material';
import { 
  Send as SendIcon, 
  Delete as DeleteIcon,
  AttachFile as AttachFileIcon,
  Image as ImageIcon,
  Description as FileIcon,
  DoneAll as DoneAllIcon,
  Done as DoneIcon,
  Logout as LogoutIcon
} from '@mui/icons-material';
import { useAuth } from '../contexts/AuthContext';
import io, { Socket } from 'socket.io-client';
import axios from 'axios';
import { useNavigate } from 'react-router-dom';
import { Encryption } from '../utils/encryption';

interface Message {
  id: string;
  sender: string;
  recipient: string;
  content: string;
  timestamp: number;
  status: 'sent' | 'delivered' | 'read' | 'deleted';
  fileUrl?: string;
  fileName?: string;
  fileType?: string;
}

interface User {
  uid: string;
  email: string;
  online: boolean;
  avatar?: string;
}

const Chat: React.FC = () => {
  const { currentUser, logout } = useAuth();
  const navigate = useNavigate();
  const [socket, setSocket] = useState<Socket | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [messageInput, setMessageInput] = useState('');
  const [users, setUsers] = useState<User[]>([]);
  const [selectedUser, setSelectedUser] = useState<User | null>(null);
  const [isTyping, setIsTyping] = useState(false);
  const [typingTimeout, setTypingTimeout] = useState<NodeJS.Timeout | null>(null);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const encryptionKey = useRef<string>(Encryption.generateKey());

  useEffect(() => {
    if (!currentUser) {
      navigate('/login');
      return;
    }

    // Register user
    axios.post('http://localhost:5001/api/users/register', {
      uid: currentUser.uid,
      email: currentUser.email
    }).catch(err => {
      console.error('Error registering user:', err);
      setError('Failed to register user');
    });

    const newSocket = io('http://localhost:5001');
    setSocket(newSocket);

    newSocket.emit('login', {
      uid: currentUser.uid,
      email: currentUser.email
    });

    newSocket.on('users', (updatedUsers: User[]) => {
      setUsers(updatedUsers.filter(user => user.uid !== currentUser.uid));
    });

    newSocket.on('message', (message: Message) => {
      setMessages(prev => [...prev, message]);
      scrollToBottom();
      
      if (message.recipient === currentUser.uid && message.status === 'sent') {
        newSocket.emit('messageDelivered', message.id);
      }
    });

    newSocket.on('messageStatus', ({ messageId, status }) => {
      setMessages(prev => 
        prev.map(msg => 
          msg.id === messageId ? { ...msg, status } : msg
        )
      );
    });

    newSocket.on('userTyping', ({ userId, isTyping }) => {
      if (selectedUser?.uid === userId) {
        setIsTyping(isTyping);
      }
    });

    // Fetch initial users list
    fetchUsers();

    return () => {
      newSocket.close();
    };
  }, [currentUser, navigate]);

  const fetchUsers = async () => {
    try {
      const response = await axios.get('http://localhost:5001/api/users');
      setUsers(response.data.filter((user: User) => user.uid !== currentUser?.uid));
      setError(null);
    } catch (err) {
      console.error('Error fetching users:', err);
      setError('Failed to fetch users');
    }
  };

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  const handleSendMessage = () => {
    if (!socket || (!messageInput.trim() && !fileInputRef.current?.files?.length) || !selectedUser) return;

    const encryptedMessage = messageInput.trim() 
      ? Encryption.encrypt(messageInput.trim(), encryptionKey.current)
      : '';

    socket.emit('sendMessage', {
      to: selectedUser.uid,
      message: encryptedMessage,
      fileUrl: null,
      fileName: null,
      fileType: null
    });

    setMessageInput('');
  };

  const handleFileSelect = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file || !socket || !selectedUser) return;

    setUploading(true);
    try {
      const formData = new FormData();
      formData.append('file', file);

      const response = await axios.post('http://localhost:5001/api/upload', formData);
      const fileUrl = response.data.url;

      socket.emit('sendMessage', {
        to: selectedUser.uid,
        message: `Shared a file: ${file.name}`,
        fileUrl,
        fileName: file.name,
        fileType: file.type
      });

      setError(null);
    } catch (error) {
      console.error('Error uploading file:', error);
      setError('Failed to upload file');
    } finally {
      setUploading(false);
    }
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

  const handleLogout = async () => {
    try {
      await logout();
      localStorage.removeItem('user');
      navigate('/login');
    } catch (error) {
      console.error('Failed to log out:', error);
    }
  };

  const renderMessageStatus = (message: Message) => {
    if (message.sender !== currentUser?.uid) return null;
    
    switch (message.status) {
      case 'sent':
        return <DoneIcon fontSize="small" sx={{ color: 'text.secondary' }} />;
      case 'delivered':
        return <DoneAllIcon fontSize="small" sx={{ color: 'text.secondary' }} />;
      case 'read':
        return <DoneAllIcon fontSize="small" sx={{ color: 'primary.main' }} />;
      default:
        return null;
    }
  };

  const renderFilePreview = (message: Message) => {
    if (!message.fileUrl) return null;

    const isImage = message.fileType?.startsWith('image/');
    
    return (
      <Box sx={{ mt: 1 }}>
        {isImage ? (
          <img 
            src={message.fileUrl} 
            alt={message.fileName}
            style={{ maxWidth: '200px', borderRadius: '4px' }}
          />
        ) : (
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
            <FileIcon />
            <Typography variant="body2">{message.fileName}</Typography>
          </Box>
        )}
      </Box>
    );
  };

  const decryptMessage = (message: Message): string => {
    if (!message.content || message.content.startsWith('Shared a file:')) {
      return message.content;
    }
    try {
      return Encryption.decrypt(message.content, encryptionKey.current);
    } catch (err) {
      console.error('Error decrypting message:', err);
      return 'Error decrypting message';
    }
  };

  return (
    <Box sx={{ height: '100vh', display: 'flex', flexDirection: 'column' }}>
      {/* Header with Logout */}
      <Box sx={{ 
        p: 2, 
        bgcolor: 'primary.main', 
        color: 'white',
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center'
      }}>
        <Typography variant="h6">
          ChatSecure
        </Typography>
        <Button 
          color="inherit" 
          onClick={handleLogout}
          startIcon={<LogoutIcon />}
        >
          Logout
        </Button>
      </Box>

      <Box sx={{ 
        flex: 1, 
        display: 'flex', 
        overflow: 'hidden',
        bgcolor: 'background.default'
      }}>
        {/* Users List */}
        <Paper sx={{ 
          width: 300, 
          overflow: 'auto',
          borderRadius: 0,
          borderRight: 1,
          borderColor: 'divider'
        }}>
          {error && (
            <Alert severity="error" sx={{ m: 1 }}>
              {error}
            </Alert>
          )}
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
                {user.online && (
                  <Box 
                    sx={{ 
                      width: 10, 
                      height: 10, 
                      borderRadius: '50%', 
                      bgcolor: 'success.main',
                      ml: 1
                    }} 
                  />
                )}
              </ListItemButton>
            ))}
          </List>
        </Paper>

        {/* Chat Area */}
        <Box sx={{ flex: 1, display: 'flex', flexDirection: 'column' }}>
          {selectedUser ? (
            <>
              {/* Messages */}
              <Paper 
                sx={{ 
                  flex: 1, 
                  overflow: 'auto', 
                  p: 2,
                  display: 'flex',
                  flexDirection: 'column',
                  gap: 1
                }}
              >
                {messages
                  .filter(msg => 
                    (msg.sender === currentUser?.uid && msg.recipient === selectedUser.uid) ||
                    (msg.sender === selectedUser.uid && msg.recipient === currentUser?.uid)
                  )
                  .map(message => (
                    <Box
                      key={message.id}
                      sx={{
                        alignSelf: message.sender === currentUser?.uid ? 'flex-end' : 'flex-start',
                        maxWidth: '70%'
                      }}
                    >
                      <Paper
                        elevation={1}
                        sx={{
                          p: 2,
                          bgcolor: message.sender === currentUser?.uid ? 'primary.main' : 'grey.100',
                          color: message.sender === currentUser?.uid ? 'white' : 'text.primary'
                        }}
                      >
                        {message.fileUrl ? (
                          renderFilePreview(message)
                        ) : (
                          <Typography>{decryptMessage(message)}</Typography>
                        )}
                        <Box sx={{ 
                          display: 'flex', 
                          alignItems: 'center', 
                          justifyContent: 'space-between',
                          mt: 1
                        }}>
                          <Typography 
                            variant="caption" 
                            color={message.sender === currentUser?.uid ? 'white' : 'text.secondary'}
                          >
                            {new Date(message.timestamp).toLocaleTimeString()}
                          </Typography>
                          <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                            {renderMessageStatus(message)}
                            {message.sender === currentUser?.uid && (
                              <IconButton
                                size="small"
                                onClick={() => handleDeleteMessage(message.id)}
                              >
                                <DeleteIcon fontSize="small" />
                              </IconButton>
                            )}
                          </Box>
                        </Box>
                      </Paper>
                    </Box>
                  ))}
                {isTyping && (
                  <Typography variant="caption" color="text.secondary">
                    {selectedUser.email} is typing...
                  </Typography>
                )}
                <div ref={messagesEndRef} />
              </Paper>

              {/* Message Input */}
              <Box sx={{ p: 2, display: 'flex', gap: 1, bgcolor: 'background.paper' }}>
                <input
                  type="file"
                  ref={fileInputRef}
                  style={{ display: 'none' }}
                  onChange={handleFileSelect}
                />
                <Tooltip title="Attach file">
                  <IconButton 
                    onClick={() => fileInputRef.current?.click()}
                    disabled={uploading}
                  >
                    {uploading ? (
                      <CircularProgress size={24} />
                    ) : (
                      <AttachFileIcon />
                    )}
                  </IconButton>
                </Tooltip>
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
                  sx={{
                    '& .MuiOutlinedInput-root': {
                      borderRadius: 5
                    }
                  }}
                />
                <Button
                  variant="contained"
                  color="primary"
                  endIcon={<SendIcon />}
                  onClick={handleSendMessage}
                  sx={{ borderRadius: 5 }}
                >
                  Send
                </Button>
              </Box>
            </>
          ) : (
            <Box sx={{ 
              height: '100%', 
              display: 'flex', 
              alignItems: 'center', 
              justifyContent: 'center',
              flexDirection: 'column',
              gap: 2
            }}>
              {users.length > 0 ? (
                <>
                  <Typography variant="h6" color="text.secondary">
                    Select a user to start chatting
                  </Typography>
                  <Typography variant="body2" color="text.secondary">
                    Choose from the list on the left
                  </Typography>
                </>
              ) : (
                <>
                  <Typography variant="h6" color="text.secondary">
                    No users available
                  </Typography>
                  <Typography variant="body2" color="text.secondary">
                    Wait for other users to come online
                  </Typography>
                </>
              )}
            </Box>
          )}
        </Box>
      </Box>
    </Box>
  );
};

export default Chat;
