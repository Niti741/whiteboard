import React, { useState, useRef, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useSocket } from '../context/SocketContext';
import { useHistory } from '../hooks/useHistory';
import { Canvas } from './Canvas';
import { Toolbar } from './Toolbar';
import { Topbar } from './Topbar';
import { UsersList } from './UsersList';
import { ShortcutsPanel } from './ShortcutsPanel';

export const Whiteboard = () => {
  const { isConnected, boardVersion } = useSocket();
  const history = useHistory();

  // Whiteboard drawing variables state
  const [tool, setTool] = useState('pencil');
  const [color, setColor] = useState('#000000');
  const [fillColor, setFillColor] = useState('transparent');
  const [size, setSize] = useState(4);

  // Canvas layout configurations
  const [gridEnabled, setGridEnabled] = useState(true);
  const [snapToGrid, setSnapToGrid] = useState(false);
  const [isDarkMode, setIsDarkMode] = useState(false);
  const [selectedElementId, setSelectedElementId] = useState(null);
  
  // Hoisted coordinate panning and zooming states
  const [pan, setPan] = useState({ x: 0, y: 0 });
  const [zoom, setZoom] = useState(1);

  // Status coordinates state (for bottom bar status tracking)
  const [hoverCoords, setHoverCoords] = useState({ x: 0, y: 0 });

  // Framer Motion Toast Notifications Queue
  const [toasts, setToasts] = useState([]); // Array of { id, message, type: 'success' | 'warning' | 'error' }

  const removeToast = useCallback((id) => {
    setToasts(prev => prev.filter(t => t.id !== id));
  }, []);

  const showToast = useCallback((message, type = 'success') => {
    // Generate a unique ID for each toast
    const id = Math.random().toString(36).substring(2, 9);
    setToasts(prev => [...prev, { id, message, type }]);
  }, []);

  // Alphanumeric keyboard shortcuts to switch active tools
  useEffect(() => {
    const handleShortcut = (e) => {
      // Ignore if user is typing inside text inputs, textareas, or fields
      if (document.activeElement.tagName === 'INPUT' || document.activeElement.tagName === 'TEXTAREA') {
        return;
      }
      
      if (e.ctrlKey || e.metaKey || e.altKey) return;

      switch (e.key.toLowerCase()) {
        case 'v':
          setTool('select');
          break;
        case 'p':
          setTool('pencil');
          break;
        case 'h':
          setTool('highlighter');
          break;
        case 'e':
          setTool('eraser');
          break;
        case 'r':
          setTool('rectangle');
          break;
        case 'o':
          setTool('circle');
          break;
        case 't':
          setTool('text');
          break;
        case 's':
          setTool('sticky');
          break;
        default:
          break;
      }
    };

    window.addEventListener('keydown', handleShortcut);
    return () => window.removeEventListener('keydown', handleShortcut);
  }, []);

  // Automatically swap black/white drawing stroke color on theme toggle to maintain visibility
  useEffect(() => {
    if (isDarkMode && color === '#000000') {
      setColor('#ffffff');
    } else if (!isDarkMode && color === '#ffffff') {
      setColor('#000000');
    }
  }, [isDarkMode, color]);

  // Monitor socket connection status changes to trigger toasts
  const prevConnectedRef = useRef(isConnected);
  useEffect(() => {
    if (prevConnectedRef.current && !isConnected) {
      showToast('Lost connection. Reconnecting to server...', 'warning');
    } else if (!prevConnectedRef.current && isConnected) {
      showToast('Successfully reconnected!', 'success');
    }
    prevConnectedRef.current = isConnected;
  }, [isConnected, showToast]);

  // Reference back to the canvas element for coordinate zoom resets
  const canvasRef = useRef(null);

  return (
    <div className="relative w-screen h-screen overflow-hidden select-none bg-bg-light dark:bg-bg-dark text-slate-800 dark:text-zinc-200">
      
      {/* 1. Core Canvas Drawing Area */}
      <div 
        onPointerMove={(e) => {
          if (canvasRef.current) {
            // Retrieve active world coordinates directly from hoisted state
            setHoverCoords({
              x: Math.round((e.clientX - pan.x) / zoom),
              y: Math.round((e.clientY - pan.y) / zoom)
            });
          }
        }}
        className="w-full h-full"
      >
        <Canvas
          tool={tool}
          color={color}
          fillColor={fillColor}
          size={size}
          gridEnabled={gridEnabled}
          snapToGrid={snapToGrid}
          history={history}
          selectedElementId={selectedElementId}
          setSelectedElementId={setSelectedElementId}
          canvasRef={canvasRef}
          pan={pan}
          setPan={setPan}
          zoom={zoom}
          setZoom={setZoom}
        />
      </div>
 
      {/* 2. Floating Header Topbar */}
      <motion.div 
        initial={{ opacity: 0, y: -50, scale: 0.95 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        transition={{ type: 'spring', damping: 20, stiffness: 100, delay: 0.1 }}
        className="absolute top-4 left-4 right-4 z-20 max-w-[calc(100vw-32px)]"
      >
        <Topbar
          gridEnabled={gridEnabled}
          setGridEnabled={setGridEnabled}
          snapToGrid={snapToGrid}
          setSnapToGrid={setSnapToGrid}
          history={history}
          selectedElementId={selectedElementId}
          setSelectedElementId={setSelectedElementId}
          canvasRef={canvasRef}
          isDarkMode={isDarkMode}
          setIsDarkMode={setIsDarkMode}
          showToast={showToast}
          zoom={zoom}
          setZoom={setZoom}
          setPan={setPan}
        />
      </motion.div>

      {/* 3. Floating Left Sidebar Toolbar */}
      <motion.div 
        initial={{ opacity: 0, x: -50, scale: 0.9 }}
        animate={{ opacity: 1, x: 0, scale: 1 }}
        transition={{ type: 'spring', damping: 18, stiffness: 90, delay: 0.2 }}
        className="absolute left-4 top-24 z-20 hidden md:block"
      >
        <Toolbar
          tool={tool}
          setTool={setTool}
          color={color}
          setColor={setColor}
          fillColor={fillColor}
          setFillColor={setFillColor}
          size={size}
          setSize={setSize}
          canvasRef={canvasRef}
        />
      </motion.div>

      {/* Mobile Toolbar (renders flat at the bottom if screen is small) */}
      <motion.div 
        initial={{ opacity: 0, y: 50 }}
        animate={{ opacity: 1, y: 0 }}
        className="absolute bottom-16 left-4 right-4 z-20 md:hidden flex justify-center"
      >
        <div className="flex gap-1.5 p-2 rounded-xl glass-panel shadow-lg overflow-x-auto max-w-full">
          <button 
            onClick={() => setTool('pencil')} 
            className={`px-3 py-1.5 rounded-lg text-xs font-semibold ${tool === 'pencil' ? 'bg-primary text-white glow-primary' : 'text-slate-600 dark:text-zinc-400'}`}
          >
            Draw
          </button>
          <button 
            onClick={() => setTool('eraser')} 
            className={`px-3 py-1.5 rounded-lg text-xs font-semibold ${tool === 'eraser' ? 'bg-primary text-white glow-primary' : 'text-slate-600 dark:text-zinc-400'}`}
          >
            Erase
          </button>
          <button 
            onClick={() => setTool('rectangle')} 
            className={`px-3 py-1.5 rounded-lg text-xs font-semibold ${tool === 'rectangle' ? 'bg-primary text-white glow-primary' : 'text-slate-600 dark:text-zinc-400'}`}
          >
            Shape
          </button>
          <button 
            onClick={() => setTool('select')} 
            className={`px-3 py-1.5 rounded-lg text-xs font-semibold ${tool === 'select' ? 'bg-primary text-white glow-primary' : 'text-slate-600 dark:text-zinc-400'}`}
          >
            Select
          </button>
        </div>
      </motion.div>

      {/* 4. Floating Right Sidebar Users List */}
      <motion.div 
        initial={{ opacity: 0, x: 50 }}
        animate={{ opacity: 1, x: 0 }}
        transition={{ type: 'spring', damping: 18, stiffness: 90, delay: 0.3 }}
        className="absolute right-4 top-24 z-20 hidden md:block"
      >
        <UsersList />
      </motion.div>

      {/* Floating Shortcuts Panel - Bottom Left */}
      <div className="absolute left-4 bottom-20 z-20 hidden md:block">
        <ShortcutsPanel />
      </div>

      {/* 5. Bottom Status Bar */}
      <motion.div 
        initial={{ opacity: 0, y: 30 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ type: 'spring', damping: 20, stiffness: 100, delay: 0.4 }}
        className="absolute bottom-4 left-4 right-4 z-10 p-2.5 rounded-xl glass-panel shadow-md flex items-center justify-between text-xs text-slate-500 dark:text-zinc-400 font-medium select-none"
      >
        {/* Connection status indicator */}
        <div className="flex items-center gap-2">
          <div className="flex items-center gap-1.5">
            <span className={`w-2.5 h-2.5 rounded-full ${
              isConnected ? 'bg-success ring-4 ring-success/20' : 'bg-danger ring-4 ring-danger/20 animate-pulse'
            }`} />
            <span className="font-bold text-[10px] uppercase tracking-wide">
              {isConnected ? 'connected' : 'connecting...'}
            </span>
          </div>
          <span className="text-slate-300 dark:text-zinc-800">|</span>
          <span className="font-mono text-[10px]">v.{boardVersion}</span>
        </div>

        {/* Current status actions */}
        <div className="hidden lg:flex items-center gap-1">
          <span className="text-[10px] font-bold text-slate-400 dark:text-zinc-500 uppercase tracking-wider">
            Tip:
          </span>
          <span>Hold <kbd className="px-1.5 py-0.5 bg-slate-100 dark:bg-zinc-800 border border-slate-200 dark:border-zinc-700 rounded text-[10px] font-bold">Space</kbd> + Drag to Pan | click <kbd className="px-1.5 py-0.5 bg-slate-100 dark:bg-zinc-800 border border-slate-200 dark:border-zinc-700 rounded text-[10px] font-bold">Del</kbd> to delete object</span>
        </div>

        {/* Coordinate details */}
        <div className="flex items-center gap-3 font-mono text-[10px] text-slate-400">
          <div>
            <span>X: </span>
            <span>{hoverCoords.x}</span>
          </div>
          <div>
            <span>Y: </span>
            <span>{hoverCoords.y}</span>
          </div>
        </div>
      </motion.div>

      {/* 6. Framer Motion Toast Notifications Overlay (Top-Right Stack with Progress Bars) */}
      <div className="absolute top-24 right-4 z-50 flex flex-col gap-2 pointer-events-none max-w-sm">
        <AnimatePresence>
          {toasts.map(t => (
            <motion.div
              key={t.id}
              layout
              initial={{ opacity: 0, y: -20, scale: 0.9 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95, transition: { duration: 0.15 } }}
              transition={{ type: 'spring', stiffness: 200, damping: 20 }}
              className="pointer-events-auto p-3.5 rounded-xl border glass-panel shadow-2xl flex flex-col gap-1.5 bg-white/95 dark:bg-zinc-950/95 min-w-[240px]"
            >
              <div className="flex items-center gap-2.5">
                <span className={`w-2.5 h-2.5 rounded-full ${
                  t.type === 'success' ? 'bg-success ring-4 ring-success/20' : 
                  t.type === 'warning' ? 'bg-warning ring-4 ring-warning/20 animate-pulse' : 
                  'bg-danger ring-4 ring-danger/20 animate-pulse'
                }`} />
                <span className="text-xs font-semibold text-slate-700 dark:text-zinc-200 leading-none">
                  {t.message}
                </span>
              </div>
              
              {/* Animated progress bar countdown that calls removeToast on complete */}
              <motion.div 
                initial={{ width: '100%' }}
                animate={{ width: '0%' }}
                transition={{ duration: 3.5, ease: 'linear' }}
                onAnimationComplete={() => removeToast(t.id)}
                className={`h-0.5 mt-1 rounded-full ${
                  t.type === 'success' ? 'bg-success' : 
                  t.type === 'warning' ? 'bg-warning' : 
                  'bg-danger'
                }`}
              />
            </motion.div>
          ))}
        </AnimatePresence>
      </div>

    </div>
  );
};
