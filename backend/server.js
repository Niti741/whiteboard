require('dotenv').config();
const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const cors = require('cors');
const mongoose = require('mongoose');
const Board = require('./models/Board');

const app = express();
const PORT = process.env.PORT || 5000;

// Enable CORS
app.use(cors({
  origin: process.env.CLIENT_URL || '*',
  methods: ['GET', 'POST'],
  credentials: true
}));

app.use(express.json());

// Basic status API
app.get('/api/status', (req, res) => {
  res.json({
    status: 'online',
    database: mongoose.connection.readyState === 1 ? 'connected' : 'disconnected (using in-memory fallback)',
    uptime: process.uptime()
  });
});

// Create HTTP Server
const server = http.createServer(app);

// Initialize Socket.IO
const io = new Server(server, {
  cors: {
    origin: process.env.CLIENT_URL || '*',
    methods: ['GET', 'POST'],
    credentials: true
  },
  pingInterval: 10000, // 10 seconds heartbeat ping
  pingTimeout: 5000 // 5 seconds timeout
});

// MongoDB Connection
let isMongoConnected = false;
const connectDB = async () => {
  try {
    const mongoUri = process.env.MONGODB_URI;
    if (!mongoUri) {
      console.warn('WARNING: MONGODB_URI is not defined. Running with in-memory board store.');
      return;
    }
    await mongoose.connect(mongoUri);
    isMongoConnected = true;
    console.log('Successfully connected to MongoDB.');
  } catch (err) {
    console.error('Failed to connect to MongoDB. Falling back to in-memory store:', err.message);
  }
};
connectDB();

// In-Memory board store fallback
const inMemoryBoards = new Map();

// Operation deduplication cache (holds clientOperationIds to ensure idempotency)
const processedOperations = new Set();
const MAX_PROCESSED_OPERATIONS = 2000;

function isDuplicateOperation(id) {
  if (!id) return false;
  if (processedOperations.has(id)) return true;
  processedOperations.add(id);
  
  // Prevent memory leaks by removing oldest entry if cache gets too large
  if (processedOperations.size > MAX_PROCESSED_OPERATIONS) {
    const firstValue = processedOperations.values().next().value;
    processedOperations.delete(firstValue);
  }
  return false;
}

// Presence tracking: room -> { users: { socketId: { id, username, color, tool } } }
const rooms = {};

// Socket.IO event handler
io.on('connection', (socket) => {
  console.log(`User connected: ${socket.id}`);
  
  // Track room ID for cleanup on disconnect
  let currentRoomId = null;

  // 1. Create Room
  socket.on('create-room', (roomId, callback) => {
    try {
      if (!roomId) {
        return callback({ success: false, code: 'INVALID_ROOM_ID', message: 'Room ID is required.' });
      }
      
      console.log(`Room created: ${roomId}`);
      callback({ success: true, data: { roomId } });
    } catch (err) {
      console.error('Error creating room:', err);
      callback({ success: false, code: 'SERVER_ERROR', message: 'Internal server error.' });
    }
  });

  // 2. Join Room
  socket.on('join-room', async ({ roomId, username, color }, callback) => {
    try {
      if (!roomId || !username) {
        return callback({ success: false, code: 'INVALID_INPUT', message: 'Room ID and Username are required.' });
      }

      currentRoomId = roomId;
      socket.join(roomId);

      // Initialize room presence structure
      if (!rooms[roomId]) {
        rooms[roomId] = { users: {} };
      }

      // Add user to presence list
      rooms[roomId].users[socket.id] = {
        id: socket.id,
        username,
        color: color || '#ff4500',
        tool: 'pencil'
      };

      // Retrieve board state
      let boardData = { elements: [], version: 1 };
      
      if (isMongoConnected) {
        let board = await Board.findOne({ roomId });
        if (!board) {
          board = await Board.create({ roomId, elements: [], version: 1 });
        }
        boardData = {
          elements: board.elements,
          version: board.version
        };
      } else {
        let board = inMemoryBoards.get(roomId);
        if (!board) {
          board = { roomId, elements: [], version: 1 };
          inMemoryBoards.set(roomId, board);
        }
        boardData = {
          elements: board.elements,
          version: board.version
        };
      }

      // Broadcast new participant list to room
      const roomUsers = Object.values(rooms[roomId].users);
      io.to(roomId).emit('room-users', roomUsers);
      
      // Let existing users know this new user has joined
      socket.to(roomId).emit('user-joined', rooms[roomId].users[socket.id]);

      console.log(`User ${username} (${socket.id}) joined room: ${roomId}`);

      // Respond to joiner with current canvas state
      callback({
        success: true,
        data: {
          elements: boardData.elements,
          version: boardData.version,
          users: roomUsers
        }
      });
    } catch (err) {
      console.error('Error joining room:', err);
      callback({ success: false, code: 'SERVER_ERROR', message: 'Failed to join room.' });
    }
  });

  // 3. Create Element (Persistent)
  socket.on('element-create', async ({ roomId, element, clientOperationId }, callback) => {
    try {
      if (!roomId || !element) {
        return callback({ success: false, code: 'INVALID_INPUT', message: 'Room ID and element are required.' });
      }

      // Handle duplicate operations safely (idempotent)
      if (isDuplicateOperation(clientOperationId)) {
        console.log(`Duplicate element-create ignored: ${clientOperationId}`);
        // Return success with current state
        let currentVersion = 1;
        if (isMongoConnected) {
          const board = await Board.findOne({ roomId });
          currentVersion = board ? board.version : 1;
        } else {
          const board = inMemoryBoards.get(roomId);
          currentVersion = board ? board.version : 1;
        }
        return callback({ success: true, data: { version: currentVersion } });
      }

      let newVersion = 1;

      if (isMongoConnected) {
        const board = await Board.findOne({ roomId });
        if (board) {
          board.elements.push(element);
          board.version += 1;
          await board.save();
          newVersion = board.version;
        } else {
          return callback({ success: false, code: 'ROOM_NOT_FOUND', message: 'Room not found.' });
        }
      } else {
        const board = inMemoryBoards.get(roomId);
        if (board) {
          board.elements.push(element);
          board.version += 1;
          newVersion = board.version;
        } else {
          return callback({ success: false, code: 'ROOM_NOT_FOUND', message: 'Room not found in memory.' });
        }
      }

      // Broadcast element and version increment to all other users in room
      socket.to(roomId).emit('element-create', { element, version: newVersion });

      callback({ success: true, data: { version: newVersion } });
    } catch (err) {
      console.error('Error creating element:', err);
      callback({ success: false, code: 'SERVER_ERROR', message: err.message || 'Failed to create element.' });
    }
  });

  // 4. Update Element (Persistent)
  socket.on('element-update', async ({ roomId, id, changes, clientOperationId }, callback) => {
    try {
      if (!roomId || !id || !changes) {
        return callback({ success: false, code: 'INVALID_INPUT', message: 'Room ID, element ID, and changes are required.' });
      }

      if (isDuplicateOperation(clientOperationId)) {
        console.log(`Duplicate element-update ignored: ${clientOperationId}`);
        let currentVersion = 1;
        if (isMongoConnected) {
          const board = await Board.findOne({ roomId });
          currentVersion = board ? board.version : 1;
        } else {
          const board = inMemoryBoards.get(roomId);
          currentVersion = board ? board.version : 1;
        }
        return callback({ success: true, data: { version: currentVersion } });
      }

      let newVersion = 1;

      if (isMongoConnected) {
        const board = await Board.findOne({ roomId });
        if (board) {
          const idx = board.elements.findIndex(el => el.id === id);
          if (idx !== -1) {
            // Merge properties
            const currentElement = board.elements[idx].toObject ? board.elements[idx].toObject() : board.elements[idx];
            const updatedElement = { ...currentElement, ...changes, updatedAt: new Date() };
            
            board.elements.set(idx, updatedElement);
            board.version += 1;
            await board.save();
            newVersion = board.version;
          } else {
            return callback({ success: false, code: 'ELEMENT_NOT_FOUND', message: 'Element to update not found.' });
          }
        } else {
          return callback({ success: false, code: 'ROOM_NOT_FOUND', message: 'Room not found.' });
        }
      } else {
        const board = inMemoryBoards.get(roomId);
        if (board) {
          const idx = board.elements.findIndex(el => el.id === id);
          if (idx !== -1) {
            board.elements[idx] = { ...board.elements[idx], ...changes, updatedAt: new Date() };
            board.version += 1;
            newVersion = board.version;
          } else {
            return callback({ success: false, code: 'ELEMENT_NOT_FOUND', message: 'Element to update not found.' });
          }
        } else {
          return callback({ success: false, code: 'ROOM_NOT_FOUND', message: 'Room not found in memory.' });
        }
      }

      // Broadcast changes to others
      socket.to(roomId).emit('element-update', { id, changes, version: newVersion });

      callback({ success: true, data: { version: newVersion } });
    } catch (err) {
      console.error('Error updating element:', err);
      callback({ success: false, code: 'SERVER_ERROR', message: err.message || 'Failed to update element.' });
    }
  });

  // 5. Delete Element (Persistent)
  socket.on('element-delete', async ({ roomId, id, clientOperationId }, callback) => {
    try {
      if (!roomId || !id) {
        return callback({ success: false, code: 'INVALID_INPUT', message: 'Room ID and element ID are required.' });
      }

      if (isDuplicateOperation(clientOperationId)) {
        console.log(`Duplicate element-delete ignored: ${clientOperationId}`);
        let currentVersion = 1;
        if (isMongoConnected) {
          const board = await Board.findOne({ roomId });
          currentVersion = board ? board.version : 1;
        } else {
          const board = inMemoryBoards.get(roomId);
          currentVersion = board ? board.version : 1;
        }
        return callback({ success: true, data: { version: currentVersion } });
      }

      let newVersion = 1;

      if (isMongoConnected) {
        const board = await Board.findOne({ roomId });
        if (board) {
          board.elements = board.elements.filter(el => el.id !== id);
          board.version += 1;
          await board.save();
          newVersion = board.version;
        } else {
          return callback({ success: false, code: 'ROOM_NOT_FOUND', message: 'Room not found.' });
        }
      } else {
        const board = inMemoryBoards.get(roomId);
        if (board) {
          board.elements = board.elements.filter(el => el.id !== id);
          board.version += 1;
          newVersion = board.version;
        } else {
          return callback({ success: false, code: 'ROOM_NOT_FOUND', message: 'Room not found in memory.' });
        }
      }

      // Broadcast deletion to others
      socket.to(roomId).emit('element-delete', { id, version: newVersion });

      callback({ success: true, data: { version: newVersion } });
    } catch (err) {
      console.error('Error deleting element:', err);
      callback({ success: false, code: 'SERVER_ERROR', message: err.message || 'Failed to delete element.' });
    }
  });

  // 6. Clear Canvas (Persistent)
  socket.on('canvas-clear', async ({ roomId, clientOperationId }, callback) => {
    try {
      if (!roomId) {
        return callback({ success: false, code: 'INVALID_INPUT', message: 'Room ID is required.' });
      }

      if (isDuplicateOperation(clientOperationId)) {
        let currentVersion = 1;
        if (isMongoConnected) {
          const board = await Board.findOne({ roomId });
          currentVersion = board ? board.version : 1;
        } else {
          const board = inMemoryBoards.get(roomId);
          currentVersion = board ? board.version : 1;
        }
        return callback({ success: true, data: { version: currentVersion } });
      }

      let newVersion = 1;

      if (isMongoConnected) {
        const board = await Board.findOne({ roomId });
        if (board) {
          board.elements = [];
          board.version += 1;
          await board.save();
          newVersion = board.version;
        } else {
          return callback({ success: false, code: 'ROOM_NOT_FOUND', message: 'Room not found.' });
        }
      } else {
        const board = inMemoryBoards.get(roomId);
        if (board) {
          board.elements = [];
          board.version += 1;
          newVersion = board.version;
        } else {
          return callback({ success: false, code: 'ROOM_NOT_FOUND', message: 'Room not found in memory.' });
        }
      }

      // Broadcast clear to others
      socket.to(roomId).emit('canvas-clear', { version: newVersion });

      callback({ success: true, data: { version: newVersion } });
    } catch (err) {
      console.error('Error clearing canvas:', err);
      callback({ success: false, code: 'SERVER_ERROR', message: 'Failed to clear canvas.' });
    }
  });

  // 7. Ephemeral Live Cursor Movement
  socket.on('cursor-update', ({ roomId, x, y }) => {
    if (!roomId) return;
    // Broadcast coordinates to other room users
    socket.to(roomId).emit('cursor-update', {
      userId: socket.id,
      x,
      y
    });
  });

  // 8. Ephemeral Live Cursor Metadata (Tool changed, name changed, color changed)
  socket.on('cursor-metadata', ({ roomId, tool, username, color }) => {
    if (!roomId) return;
    
    if (rooms[roomId] && rooms[roomId].users[socket.id]) {
      rooms[roomId].users[socket.id].tool = tool || 'pencil';
      if (username) rooms[roomId].users[socket.id].username = username;
      if (color) rooms[roomId].users[socket.id].color = color;
      
      // Broadcast updated metadata to others
      socket.to(roomId).emit('cursor-metadata', {
        userId: socket.id,
        tool: rooms[roomId].users[socket.id].tool,
        username: rooms[roomId].users[socket.id].username,
        color: rooms[roomId].users[socket.id].color
      });

      // Broadcast complete user list update
      io.to(roomId).emit('room-users', Object.values(rooms[roomId].users));
    }
  });

  // 9. Leave Room explicitly
  socket.on('leave-room', (roomId) => {
    if (!roomId) return;
    socket.leave(roomId);
    
    if (rooms[roomId] && rooms[roomId].users[socket.id]) {
      const user = rooms[roomId].users[socket.id];
      delete rooms[roomId].users[socket.id];
      
      console.log(`User ${user.username} left room: ${roomId}`);
      
      // Clean up empty room presence
      if (Object.keys(rooms[roomId].users).length === 0) {
        delete rooms[roomId];
      } else {
        // Broadcast user left event and updated list
        socket.to(roomId).emit('user-left', socket.id);
        io.to(roomId).emit('room-users', Object.values(rooms[roomId].users));
      }
    }
    currentRoomId = null;
  });

  // 10. Disconnect
  socket.on('disconnect', () => {
    console.log(`User disconnected: ${socket.id}`);
    
    if (currentRoomId && rooms[currentRoomId]) {
      const user = rooms[currentRoomId].users[socket.id];
      if (user) {
        delete rooms[currentRoomId].users[socket.id];
        console.log(`Cleaned up user ${user.username} presence in room: ${currentRoomId}`);
        
        if (Object.keys(rooms[currentRoomId].users).length === 0) {
          delete rooms[currentRoomId];
        } else {
          // Broadcast user left event and updated list
          socket.to(currentRoomId).emit('user-left', socket.id);
          io.to(currentRoomId).emit('room-users', Object.values(rooms[currentRoomId].users));
        }
      }
    }
  });
});

// Start listening
server.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
});
