import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { useSocket } from '../context/SocketContext';
import { Sparkles, Palette, LogIn, Plus, User } from 'lucide-react';

export const RoomPanel = () => {
  const { joinRoom, error: socketError } = useSocket();

  const [usernameInput, setUsernameInput] = useState('');
  const [roomIdInput, setRoomIdInput] = useState('');
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  // Check URL query parameters for invitation links
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const roomParam = params.get('room');
    if (roomParam) {
      setRoomIdInput(roomParam);
    }
  }, []);

  // Generate secure random room ID (alphanumeric, 8 chars)
  const generateRoomId = () => {
    const chars = 'abcdefghijklmnopqrstuvwxyz0123456789';
    let id = '';
    for (let i = 0; i < 8; i++) {
      id += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    // Format as xxxx-xxxx
    return `${id.slice(0, 4)}-${id.slice(4)}`;
  };

  // Submit join handler
  const handleJoin = (e) => {
    e.preventDefault();
    setError('');

    if (!usernameInput.trim()) {
      setError('Please enter a username.');
      return;
    }
    if (!roomIdInput.trim()) {
      setError('Please enter or create a Room ID.');
      return;
    }

    setIsLoading(true);
    joinRoom({
      roomId: roomIdInput.trim().toLowerCase(),
      username: usernameInput.trim()
    }, (res) => {
      setIsLoading(false);
      if (!res.success) {
        setError(res.message || 'Failed to connect to the room.');
      }
    });
  };

  // Submit create room handler
  const handleCreate = (e) => {
    e.preventDefault();
    setError('');

    if (!usernameInput.trim()) {
      setError('Please enter a username first.');
      return;
    }

    const generatedId = generateRoomId();
    setIsLoading(true);
    
    joinRoom({
      roomId: generatedId,
      username: usernameInput.trim()
    }, (res) => {
      setIsLoading(false);
      if (!res.success) {
        setError(res.message || 'Failed to create room.');
      } else {
        // Sync URL with room ID
        const nextUrl = `${window.location.origin}${window.location.pathname}?room=${generatedId}`;
        window.history.pushState({ path: nextUrl }, '', nextUrl);
      }
    });
  };

  // Submit offline Solo Mode handler
  const handleGoSolo = (e) => {
    e.preventDefault();
    setError('');

    // Default to 'Solo Artist' if name is left blank
    const name = usernameInput.trim() || 'Solo Artist';

    setIsLoading(true);
    joinRoom({
      roomId: 'personal-board',
      username: name
    }, (res) => {
      setIsLoading(false);
      if (!res.success) {
        setError(res.message || 'Failed to enter personal board.');
      }
    });
  };

  return (
    <div className="min-h-screen w-full flex items-center justify-center bg-bg-light p-6 md:p-12 relative overflow-x-hidden overflow-y-auto font-sans noise-overlay select-none">
      
      {/* Background drifting mesh */}
      <div className="absolute inset-0 mesh-gradient opacity-80" />

      {/* Floating blurred color blobs */}
      <div className="absolute top-1/10 left-1/10 w-96 h-96 bg-primary/10 rounded-full blur-3xl animate-orb-1" />
      <div className="absolute bottom-1/10 right-1/10 w-96 h-96 bg-secondary/10 rounded-full blur-3xl animate-orb-2" />

      <div className="w-full max-w-6xl grid grid-cols-1 lg:grid-cols-12 gap-12 items-center relative z-10">
        
        {/* Left Column: Brand presentation and Floating UI illustration mockup */}
        <div className="lg:col-span-7 flex flex-col gap-6 text-left">
          <motion.div
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ type: 'spring', damping: 20 }}
            className="flex items-center gap-2.5 px-3.5 py-1.5 rounded-full bg-slate-100/80 border border-slate-200 w-fit backdrop-blur-md"
          >
            <span className="w-2 h-2 rounded-full bg-accent ring-4 ring-accent/30 animate-pulse" />
            <span className="text-[10px] uppercase font-bold tracking-widest text-black">
              real-time collaboration active
            </span>
          </motion.div>

          <div className="flex flex-col gap-3">
            <motion.h1 
              initial={{ opacity: 0, x: -30 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ type: 'spring', damping: 18, delay: 0.1 }}
              className="text-4xl sm:text-6xl font-extrabold tracking-tight text-black leading-tight font-heading"
            >
              Collaborate and sketch <br />
              <span className="text-black">
                in real time.
              </span>
            </motion.h1>
            
            <motion.p
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 0.2 }}
              className="text-black text-sm sm:text-base max-w-lg leading-relaxed font-medium"
            >
              CoDraw is a premium, vector-powered infinite whiteboard designed for developers and designers to build together offline and online. No delay, fully responsive.
            </motion.p>
          </div>

          {/* 3D Illustration preview panel */}
          <div className="relative mt-4 h-64 sm:h-80 w-full rounded-2xl border border-slate-200 bg-white shadow-2xl overflow-hidden hidden sm:block">
            {/* Grid overlay */}
            <div className="absolute inset-0 z-10 pointer-events-none" style={{ 
              backgroundImage: 'radial-gradient(rgba(148,163,184,0.12) 1px, transparent 0)', 
              backgroundSize: '24px 24px' 
            }} />

            {/* Generated 3D Image */}
            <img 
              src="/three_people_drawing.png" 
              alt="Three people drawing" 
              className="absolute inset-0 w-full h-full object-cover select-none"
            />
          </div>
        </div>

        {/* Right Column: Glass Login Panel Card */}
        <div className="lg:col-span-5 w-full flex justify-center">
          <motion.div
            initial={{ opacity: 0, scale: 0.92, y: 30 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            transition={{ type: 'spring', damping: 20, delay: 0.15 }}
            className="w-full max-w-md py-5 px-6 rounded-3xl bg-white/75 border border-slate-200 backdrop-blur-xl shadow-2xl relative z-10"
          >
            {/* Header Branding */}
            <div className="flex flex-col items-center mb-4">
              <motion.div
                whileHover={{ rotate: 15, scale: 1.1 }}
                whileTap={{ scale: 0.95 }}
                className="w-12 h-12 bg-[#86EFAC] text-emerald-950 border border-emerald-300 rounded-2xl flex items-center justify-center shadow-md shadow-emerald-500/10 mb-2 cursor-pointer"
              >
                <Palette size={24} />
              </motion.div>
              <h2 className="text-2xl font-extrabold tracking-tight text-black font-heading">
                CoDraw
              </h2>
              <p className="text-[11px] text-black mt-1 font-medium">
                Modern collaborative vector canvas
              </p>
            </div>

            {/* Input Form */}
            <form className="flex flex-col gap-3">
              {/* Username Input */}
              <div>
                <label className="block text-[10px] font-bold text-black uppercase tracking-wider mb-1 px-1">
                  Your Name
                </label>
                <input
                  type="text"
                  maxLength={20}
                  placeholder="Enter your name..."
                  value={usernameInput}
                  onChange={(e) => setUsernameInput(e.target.value)}
                  className="w-full px-4 py-2.5 rounded-xl border border-slate-200 bg-white text-black placeholder-slate-400 focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 premium-input text-sm font-semibold"
                />
              </div>

              {/* Room ID Input */}
              <div>
                <label className="block text-[10px] font-bold text-black uppercase tracking-wider mb-1 px-1 flex justify-between items-center">
                  <span>Room ID</span>
                  {roomIdInput && (
                    <button 
                      type="button" 
                      onClick={() => setRoomIdInput('')}
                      className="text-[9px] text-red-500 lowercase hover:underline cursor-pointer"
                    >
                      clear
                    </button>
                  )}
                </label>
                <input
                  type="text"
                  placeholder="Enter existing room ID..."
                  value={roomIdInput}
                  onChange={(e) => setRoomIdInput(e.target.value.toLowerCase())}
                  className="w-full px-4 py-2.5 rounded-xl border border-slate-200 bg-white text-black placeholder-slate-400 focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 transition-all font-mono text-center tracking-wide text-sm font-semibold"
                />
              </div>

              {/* Error logs */}
              {(error || socketError) && (
                <div className="p-2.5 rounded-lg border border-red-500/20 bg-red-500/10 text-red-500 text-[11px] font-semibold text-center leading-relaxed">
                  {error || socketError}
                </div>
              )}

              {/* Action Buttons */}
              <div className="flex flex-col gap-2.5 mt-2.5">
                {/* Join Room */}
                <motion.button
                  whileHover={{ scale: 1.03, boxShadow: '0 0 15px rgba(79, 70, 229, 0.4)' }}
                  whileTap={{ scale: 0.97 }}
                  onClick={handleJoin}
                  disabled={isLoading}
                  className="w-full py-2.5 px-4 bg-gradient-to-r from-primary to-secondary text-white font-semibold rounded-xl flex items-center justify-center gap-2 transition duration-200 cursor-pointer shadow-lg shadow-indigo-500/20 text-sm"
                >
                  {isLoading ? (
                    <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  ) : (
                    <>
                      <LogIn size={14} />
                      <span>Join Collaborative Room</span>
                    </>
                  )}
                </motion.button>

                {/* Create Room */}
                <motion.button
                  whileHover={{ scale: 1.03 }}
                  whileTap={{ scale: 0.97 }}
                  onClick={handleCreate}
                  disabled={isLoading}
                  className="w-full py-2.5 px-4 bg-slate-100 hover:bg-slate-200 text-black border border-slate-200 font-semibold rounded-xl flex items-center justify-center gap-2 transition duration-200 cursor-pointer text-sm"
                >
                  <Plus size={14} className="text-emerald-600" />
                  <span>Create Collaborative Room</span>
                </motion.button>

                <div className="flex items-center my-1">
                  <hr className="flex-grow border-slate-200" />
                  <span className="px-3 text-[9px] font-bold text-black uppercase tracking-widest">or</span>
                  <hr className="flex-grow border-slate-200" />
                </div>

                {/* Go Solo */}
                <motion.button
                  whileHover={{ scale: 1.03, borderColor: 'rgba(245, 158, 11, 0.8)', background: 'rgba(245, 158, 11, 0.08)' }}
                  whileTap={{ scale: 0.97 }}
                  onClick={handleGoSolo}
                  disabled={isLoading}
                  className="w-full py-2.5 px-4 bg-amber-50 hover:bg-amber-100 border border-amber-200 text-black font-semibold rounded-xl flex items-center justify-center gap-2 transition duration-200 cursor-pointer text-sm"
                >
                  <User size={14} className="text-amber-600" />
                  <span>Go Solo (Private Offline Board)</span>
                </motion.button>
              </div>
            </form>

            {/* Badges */}
            <div className="mt-6 pt-4 border-t border-slate-100 flex justify-around text-[9px] font-bold text-black uppercase tracking-wide">
              <div className="flex items-center gap-1">
                <Sparkles size={11} className="text-primary" />
                <span>realtime sync</span>
              </div>
              <div className="flex items-center gap-1">
                <Sparkles size={11} className="text-secondary" />
                <span>vector paths</span>
              </div>
              <div className="flex items-center gap-1">
                <Sparkles size={11} className="text-accent" />
                <span>infinite zoom</span>
              </div>
            </div>

          </motion.div>
        </div>

      </div>
    </div>
  );
};
