import React, { useState, useEffect } from 'react';
import { SocketProvider, useSocket } from './context/SocketContext';
import { RoomPanel } from './components/RoomPanel';
import { Whiteboard } from './components/Whiteboard';

const AppContent = () => {
  const { roomId } = useSocket();
  const [showTransition, setShowTransition] = useState(false);
  const [activeScreen, setActiveScreen] = useState('lobby'); // 'lobby' | 'board'

  useEffect(() => {
    if (roomId) {
      // Trigger transition curtain
      setShowTransition(true);
      const timer1 = setTimeout(() => {
        setActiveScreen('board');
      }, 300); // Sync screen swap mid-transition
      
      const timer2 = setTimeout(() => {
        setShowTransition(false);
      }, 1000); // Complete animation

      return () => {
        clearTimeout(timer1);
        clearTimeout(timer2);
      };
    } else {
      setActiveScreen('lobby');
    }
  }, [roomId]);

  return (
    <div className={`relative w-screen h-screen ${activeScreen === 'lobby' ? 'overflow-y-auto overflow-x-hidden' : 'overflow-hidden'}`}>
      {activeScreen === 'lobby' ? <RoomPanel /> : <Whiteboard />}

      {/* Smooth Premium Entry Curtain */}
      {showTransition && (
        <div className="absolute inset-0 bg-slate-950 z-[9999] flex flex-col items-center justify-center animate-fade-out">
          <div className="flex flex-col items-center gap-4">
            <div className="w-10 h-10 border-4 border-sky-500/20 border-t-sky-500 rounded-full animate-spin" />
            <span className="text-sm font-semibold tracking-wider text-sky-400 font-heading uppercase animate-pulse">
              Entering Whiteboard...
            </span>
          </div>
        </div>
      )}
    </div>
  );
};

function App() {
  return (
    <SocketProvider>
      <AppContent />
    </SocketProvider>
  );
}

export default App;

