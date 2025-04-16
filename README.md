# ChatSecure - End-to-End Encrypted Messaging

A secure messaging application with end-to-end encryption, real-time chat, file sharing, and group chat capabilities.

## Features

- End-to-end encryption using AES-256 and RSA
- Real-time messaging with typing indicators
- Group chat functionality
- Secure file sharing
- User presence status
- Read receipts
- Firebase authentication
- Responsive modern UI

## Tech Stack

- Frontend: React.js with TypeScript
- Backend: Node.js + Express
- Real-time: Socket.IO
- Database: MongoDB
- Authentication & Storage: Firebase
- UI: Material-UI

## Getting Started

1. Clone the repository
2. Install dependencies:
   ```bash
   npm install
   cd client
   npm install
   ```

3. Set up Firebase:
   - Create a new Firebase project
   - Enable Authentication and Storage
   - Copy your Firebase config

4. Create a `.env` file in the client directory with:
   ```
   REACT_APP_API_URL=http://localhost:5001
   REACT_APP_SOCKET_URL=http://localhost:5001
   REACT_APP_FIREBASE_API_KEY=your_api_key
   REACT_APP_FIREBASE_AUTH_DOMAIN=your_auth_domain
   REACT_APP_FIREBASE_PROJECT_ID=your_project_id
   REACT_APP_FIREBASE_STORAGE_BUCKET=your_storage_bucket
   REACT_APP_FIREBASE_MESSAGING_SENDER_ID=your_sender_id
   REACT_APP_FIREBASE_APP_ID=your_app_id
   ```

5. Create a `.env` file in the root directory with:
   ```
   MONGODB_URI=your_mongodb_uri
   PORT=5001
   ```

6. Start the development servers:
   ```bash
   # Start backend server
   npm run start
   
   # In another terminal, start frontend
   cd client
   npm start
   ```

## Security Features

- AES-256 encryption for messages
- RSA for key exchange
- Secure file encryption
- Firebase Authentication
- HTTPS enforced
- XSS protection
- Rate limiting
- Secure WebSocket connections
- MongoDB encryption at rest

## API Documentation

### WebSocket Events

- `connection`: New client connected
- `login`: User logged in
- `sendMessage`: Send private or group message
- `typing`: User typing indicator
- `userStatus`: Online/offline status updates

### REST Endpoints

- POST `/api/users/register`: Register new user
- POST `/api/users/login`: User login
- GET `/api/messages/:userId`: Get chat history
- POST `/api/messages`: Send new message
- GET `/api/groups`: Get user's groups
- POST `/api/groups`: Create new group

## Contributing

1. Fork the repository
2. Create your feature branch (`git checkout -b feature/AmazingFeature`)
3. Commit your changes (`git commit -m 'Add some AmazingFeature'`)
4. Push to the branch (`git push origin feature/AmazingFeature`)
5. Open a Pull Request

## License

MIT

## Support

For support, email support@chatsecure.com or join our Slack channel.
