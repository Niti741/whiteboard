import React, { createContext, useContext, useState, useEffect, useCallback, useRef } from 'react';
import { io } from 'socket.io-client';
import { uuidv7 } from '../utils/geometry';

const SocketContext = createContext(null);

export const useSocket = () => {
  const context = useContext(SocketContext);
  if (!context) {
    throw new Error('useSocket must be used within a SocketProvider');
  }
  return context;
};

const BACKEND_URL = import.meta.env.VITE_BACKEND_URL || 'http://localhost:5000';

export const SocketProvider = ({ children }) => {
  const [socket, setSocket] = useState(null);
  const [isConnected, setIsConnected] = useState(false);
  const [roomId, setRoomId] = useState('');
  const [username, setUsername] = useState('');
  const [userColor, setUserColor] = useState('');
  const [users, setUsers] = useState([]);
  const [elements, setElements] = useState([]);
  const [boardVersion, setBoardVersion] = useState(1);
  const [error, setError] = useState(null);

  // Live remote cursors: { socketId: { x, y, username, color, tool } }
  const [remoteCursors, setRemoteCursors] = useState({});
  // Live remote active drawings (before mouseup): { socketId: element }
  const [remoteDrawingPreviews, setRemoteDrawingPreviews] = useState({});

  // Keep a reference to elements to access within socket listeners without re-binding
  const elementsRef = useRef([]);
  elementsRef.current = elements;

  // Track colors for each user (random color generator)
  const getRandomColor = () => {
    const colors = [
      '#ef4444', '#f97316', '#f59e0b', '#10b981', '#06b6d4', 
      '#3b82f6', '#6366f1', '#8b5cf6', '#d946ef', '#ec4899'
    ];
    return colors[Math.floor(Math.random() * colors.length)];
  };

  // Connect socket once joined (or initialize local-only session)
  const joinRoom = useCallback(({ roomId: targetRoomId, username: targetUsername }, callback) => {
    const selectedColor = getRandomColor();
    setUserColor(selectedColor);
    setUsername(targetUsername);
    setRoomId(targetRoomId);

    // 1. Local-Only Personal Board Session (Offline / localStorage)
    if (targetRoomId === 'personal-board') {
      setIsConnected(true);
      setError(null);
      setUsers([
        {
          id: 'local',
          username: targetUsername,
          color: selectedColor,
          tool: 'pencil'
        }
      ]);

      // Load elements from browser localStorage
      const stored = localStorage.getItem('codraw_personal_board');
      const initialElements = stored ? JSON.parse(stored) : [];
      setElements(initialElements);
      setBoardVersion(1);

      if (callback) callback({ success: true });
      return;
    }

    // 2. Real-Time Socket Connection Session (Collaborative)
    const socketInstance = io(BACKEND_URL, {
      transports: ['websocket', 'polling'],
      autoConnect: true,
      reconnection: true,
      reconnectionAttempts: 10,
      reconnectionDelay: 1000
    });

    setSocket(socketInstance);

    socketInstance.on('connect', () => {
      setIsConnected(true);
      setError(null);
      console.log('Connected to socket server');

      // Join the specified room on server
      socketInstance.emit('join-room', { 
        roomId: targetRoomId, 
        username: targetUsername, 
        color: selectedColor 
      }, (response) => {
        if (response.success) {
          setElements(response.data.elements);
          setBoardVersion(response.data.version);
          setUsers(response.data.users);
          if (callback) callback({ success: true });
        } else {
          setError(response.message);
          if (callback) callback({ success: false, message: response.message });
        }
      });
    });

    socketInstance.on('disconnect', () => {
      setIsConnected(false);
      console.log('Disconnected from socket server');
    });

    socketInstance.on('connect_error', (err) => {
      console.error('Socket connection error:', err);
      setError('Could not connect to the real-time server.');
    });

    // Set up Synchronized Listeners
    socketInstance.on('room-users', (roomUsers) => {
      setUsers(roomUsers);
    });

    socketInstance.on('user-left', (leftSocketId) => {
      setRemoteCursors(prev => {
        const next = { ...prev };
        delete next[leftSocketId];
        return next;
      });
      setRemoteDrawingPreviews(prev => {
        const next = { ...prev };
        delete next[leftSocketId];
        return next;
      });
    });

    // Element Mutations (Socket)
    socketInstance.on('element-create', ({ element, version }) => {
      setElements(prev => {
        if (prev.some(el => el.id === element.id)) return prev;
        return [...prev, element];
      });
      setBoardVersion(version);
    });

    socketInstance.on('element-update', ({ id, changes, version }) => {
      setElements(prev => prev.map(el => el.id === id ? { ...el, ...changes } : el));
      setBoardVersion(version);
    });

    socketInstance.on('element-delete', ({ id, version }) => {
      setElements(prev => prev.filter(el => el.id !== id));
      setBoardVersion(version);
    });

    socketInstance.on('canvas-clear', ({ version }) => {
      setElements([]);
      setBoardVersion(version);
      setRemoteDrawingPreviews({});
    });

    // Ephemeral cursors
    socketInstance.on('cursor-update', ({ userId, x, y }) => {
      setRemoteCursors(prev => {
        const existing = prev[userId] || {};
        return {
          ...prev,
          [userId]: { ...existing, x, y }
        };
      });
    });

    socketInstance.on('cursor-metadata', ({ userId, tool, username: rName, color: rColor }) => {
      setRemoteCursors(prev => {
        const existing = prev[userId] || {};
        return {
          ...prev,
          [userId]: { ...existing, tool, username: rName, color: rColor }
        };
      });
    });

    return () => {
      socketInstance.disconnect();
    };
  }, []);

  // Action: Leave room
  const leaveRoom = useCallback(() => {
    if (socket) {
      socket.emit('leave-room', roomId);
      socket.disconnect();
    }
    setSocket(null);
    setIsConnected(false);
    setRoomId('');
    setUsername('');
    setUsers([]);
    setElements([]);
    setRemoteCursors({});
    setRemoteDrawingPreviews({});
  }, [socket, roomId]);

  // Action: Create element (returns promise for undo/redo commands)
  const emitCreate = useCallback((element) => {
    return new Promise((resolve, reject) => {
      // Local storage save for Personal Board
      if (roomId === 'personal-board') {
        setElements(prev => {
          if (prev.some(el => el.id === element.id)) return prev;
          const next = [...prev, element];
          localStorage.setItem('codraw_personal_board', JSON.stringify(next));
          return next;
        });
        return resolve({ version: 1 });
      }

      if (!socket || !isConnected) return reject(new Error('Socket disconnected'));
      
      const clientOperationId = uuidv7();
      
      // Update locally immediately (optimistic UI)
      setElements(prev => {
        if (prev.some(el => el.id === element.id)) return prev;
        return [...prev, element];
      });

      socket.emit('element-create', { roomId, element, clientOperationId }, (response) => {
        if (response.success) {
          setBoardVersion(response.data.version);
          resolve(response.data);
        } else {
          setElements(prev => prev.filter(el => el.id !== element.id));
          reject(new Error(response.message));
        }
      });
    });
  }, [socket, isConnected, roomId]);

  // Action: Update element
  const emitUpdate = useCallback((id, changes) => {
    return new Promise((resolve, reject) => {
      // Local storage save for Personal Board
      if (roomId === 'personal-board') {
        setElements(prev => {
          const next = prev.map(el => el.id === id ? { ...el, ...changes } : el);
          localStorage.setItem('codraw_personal_board', JSON.stringify(next));
          return next;
        });
        return resolve({ version: 1 });
      }

      if (!socket || !isConnected) return reject(new Error('Socket disconnected'));

      const clientOperationId = uuidv7();
      const previousState = elementsRef.current.find(el => el.id === id);
      
      setElements(prev => prev.map(el => el.id === id ? { ...el, ...changes } : el));

      socket.emit('element-update', { roomId, id, changes, clientOperationId }, (response) => {
        if (response.success) {
          setBoardVersion(response.data.version);
          resolve(response.data);
        } else {
          if (previousState) {
            setElements(prev => prev.map(el => el.id === id ? previousState : el));
          }
          reject(new Error(response.message));
        }
      });
    });
  }, [socket, isConnected, roomId]);

  // Action: Delete element
  const emitDelete = useCallback((id) => {
    return new Promise((resolve, reject) => {
      // Local storage save for Personal Board
      if (roomId === 'personal-board') {
        setElements(prev => {
          const next = prev.filter(el => el.id !== id);
          localStorage.setItem('codraw_personal_board', JSON.stringify(next));
          return next;
        });
        return resolve({ version: 1 });
      }

      if (!socket || !isConnected) return reject(new Error('Socket disconnected'));

      const clientOperationId = uuidv7();
      const previousElement = elementsRef.current.find(el => el.id === id);

      setElements(prev => prev.filter(el => el.id !== id));

      socket.emit('element-delete', { roomId, id, clientOperationId }, (response) => {
        if (response.success) {
          setBoardVersion(response.data.version);
          resolve(response.data);
        } else {
          if (previousElement) {
            setElements(prev => [...prev, previousElement]);
          }
          reject(new Error(response.message));
        }
      });
    });
  }, [socket, isConnected, roomId]);

  // Action: Clear canvas
  const emitClear = useCallback(() => {
    return new Promise((resolve, reject) => {
      // Local storage clear for Personal Board
      if (roomId === 'personal-board') {
        setElements([]);
        localStorage.removeItem('codraw_personal_board');
        return resolve({ version: 1 });
      }

      if (!socket || !isConnected) return reject(new Error('Socket disconnected'));

      const clientOperationId = uuidv7();
      const backupElements = [...elementsRef.current];

      setElements([]);

      socket.emit('canvas-clear', { roomId, clientOperationId }, (response) => {
        if (response.success) {
          setBoardVersion(response.data.version);
          resolve(response.data);
        } else {
          setElements(backupElements);
          reject(new Error(response.message));
        }
      });
    });
  }, [socket, isConnected, roomId]);

  // Action: Broadcast live cursor movement (throttled inside components)
  const emitCursor = useCallback((x, y) => {
    if (roomId === 'personal-board') return; // Skip in solo mode
    if (socket && isConnected) {
      socket.emit('cursor-update', { roomId, x, y });
    }
  }, [socket, isConnected, roomId]);

  // Action: Broadcast tool metadata changed
  const emitCursorMetadata = useCallback((tool) => {
    if (roomId === 'personal-board') return; // Skip in solo mode
    if (socket && isConnected) {
      socket.emit('cursor-metadata', { 
        roomId, 
        tool, 
        username, 
        color: userColor 
      });
    }
  }, [socket, isConnected, roomId, username, userColor]);

  // Action: Broadcast active drawing previews (ephemeral, not saved to db)
  const emitDrawingPreview = useCallback((element) => {
    if (roomId === 'personal-board') return; // Skip in solo mode
    if (socket && isConnected) {
      socket.emit('drawing-preview', { roomId, userId: socket.id, element });
    }
  }, [socket, isConnected, roomId]);

  // Bind listener for drawing previews from other users
  useEffect(() => {
    if (!socket) return;

    socket.on('drawing-preview', ({ userId, element }) => {
      setRemoteDrawingPreviews(prev => {
        if (!element) {
          const next = { ...prev };
          delete next[userId];
          return next;
        }
        return { ...prev, [userId]: element };
      });
    });

    return () => {
      socket.off('drawing-preview');
    };
  }, [socket]);

  return (
    <SocketContext.Provider value={{
      socket,
      isConnected,
      roomId,
      username,
      userColor,
      users,
      elements,
      boardVersion,
      error,
      remoteCursors,
      remoteDrawingPreviews,
      joinRoom,
      leaveRoom,
      emitCreate,
      emitUpdate,
      emitDelete,
      emitClear,
      emitCursor,
      emitCursorMetadata,
      emitDrawingPreview,
      setElements
    }}>
      {children}
    </SocketContext.Provider>
  );
};
