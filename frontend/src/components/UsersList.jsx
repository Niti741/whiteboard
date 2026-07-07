import React from 'react';
import { motion } from 'framer-motion';
import { useSocket } from '../context/SocketContext';
import { 
  MousePointer, Pencil, Highlighter, Eraser, 
  Square, Circle, Minus, ArrowUpRight, Type, Sparkles 
} from 'lucide-react';

export const UsersList = () => {
  const { users, socket, remoteCursors } = useSocket();

  // Helper to map tools to icons
  const getToolIcon = (toolName) => {
    switch (toolName) {
      case 'select': return <MousePointer size={11} />;
      case 'pencil': return <Pencil size={11} />;
      case 'highlighter': return <Highlighter size={11} />;
      case 'eraser': return <Eraser size={11} />;
      case 'rectangle': return <Square size={11} />;
      case 'circle': return <Circle size={11} />;
      case 'line': return <Minus size={11} />;
      case 'arrow': return <ArrowUpRight size={11} />;
      case 'text': return <Type size={11} />;
      case 'laser': return <Sparkles size={11} />;
      default: return <Pencil size={11} />;
    }
  };

  return (
    <div className="flex flex-col gap-3 p-3 rounded-2xl glass-panel shadow-2xl w-56 select-none max-h-72 overflow-y-auto">
      
      {/* Title */}
      <span className="text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider block px-1">
        collaborators ({users.length})
      </span>

      {/* Collaborators List */}
      <div className="flex flex-col gap-1.5">
        {users.map((u, i) => {
          const isLocal = u.id === socket?.id;
          
          // Get live tool state of this user
          const liveTool = isLocal 
            ? 'select' 
            : (remoteCursors[u.id]?.tool || u.tool || 'pencil');

          return (
            <motion.div 
              key={u.id}
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: i * 0.05, type: 'spring', stiffness: 200, damping: 20 }}
              className="flex items-center justify-between p-2 rounded-lg bg-slate-50/65 dark:bg-slate-900/40 hover:bg-slate-100/80 dark:hover:bg-slate-800/60 transition duration-150"
            >
              <div className="flex items-center gap-2 max-w-[70%]">
                {/* User initials circle */}
                <div 
                  className="w-6 h-6 rounded-full flex items-center justify-center text-[10px] font-bold text-white uppercase shadow-inner"
                  style={{ backgroundColor: u.color }}
                >
                  {u.username.slice(0, 2)}
                </div>

                {/* Name */}
                <span className="text-xs font-semibold text-slate-700 dark:text-slate-200 truncate">
                  {u.username}
                  {isLocal && <span className="text-[9px] text-slate-400 dark:text-slate-500 font-normal ml-1">(you)</span>}
                </span>
              </div>

              {/* Active Tool Badge */}
              <div 
                className="flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-medium border"
                style={{ 
                  color: u.color,
                  borderColor: `${u.color}33`,
                  backgroundColor: `${u.color}11`
                }}
              >
                {getToolIcon(liveTool)}
                <span className="capitalize">{liveTool === 'pencil' ? 'draw' : liveTool}</span>
              </div>
            </motion.div>
          );
        })}
      </div>
    </div>
  );
};
