import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Keyboard, X, MousePointer, Pencil, Highlighter, Eraser, Square, Circle, Type, StickyNote, HelpCircle } from 'lucide-react';

export const ShortcutsPanel = () => {
  const [isOpen, setIsOpen] = useState(false);

  const shortcutGroups = [
    {
      title: 'Drawing Tools',
      items: [
        { key: 'V', desc: 'Select Object', icon: MousePointer },
        { key: 'P', desc: 'Pencil', icon: Pencil },
        { key: 'H', desc: 'Highlighter', icon: Highlighter },
        { key: 'E', desc: 'Eraser', icon: Eraser },
        { key: 'R', desc: 'Rectangle Shape', icon: Square },
        { key: 'O', desc: 'Circle Shape', icon: Circle },
        { key: 'T', desc: 'Text Field', icon: Type },
        { key: 'S', desc: 'Sticky Note', icon: StickyNote },
      ]
    },
    {
      title: 'Canvas Navigation',
      items: [
        { key: 'Space + Drag', desc: 'Pan Board' },
        { key: 'Ctrl + Scroll', desc: 'Zoom In / Out' },
        { key: 'Double Click', desc: 'Edit Text / Sticky Note' },
        { key: 'Del / Backspace', desc: 'Delete Selected Object' },
        { key: 'Ctrl + Z', desc: 'Undo drawing' },
        { key: 'Ctrl + Shift + Z', desc: 'Redo drawing' },
      ]
    }
  ];

  return (
    <div className="relative select-none">
      {/* Collapsed Help Button */}
      <motion.button
        whileHover={{ scale: 1.05 }}
        whileTap={{ scale: 0.95 }}
        onClick={() => setIsOpen(!isOpen)}
        className="w-10 h-10 rounded-full bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 text-slate-700 dark:text-zinc-300 shadow-lg flex items-center justify-center cursor-pointer hover:bg-slate-50 dark:hover:bg-zinc-850"
        title="Keyboard Shortcuts Cheatsheet"
      >
        {isOpen ? <X size={18} /> : <Keyboard size={18} />}
      </motion.button>

      {/* Floating Cheat Sheet Panel */}
      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ opacity: 0, scale: 0.95, y: 15 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 15 }}
            transition={{ type: 'spring', damping: 20 }}
            className="absolute left-0 bottom-12 w-72 p-4 rounded-2xl glass-panel shadow-2xl z-50 border border-slate-200 dark:border-zinc-800 bg-white/95 dark:bg-zinc-950/95"
          >
            <div className="flex items-center justify-between mb-3 border-b border-slate-100 dark:border-zinc-800 pb-2">
              <div className="flex items-center gap-1.5 text-slate-800 dark:text-zinc-200 font-bold text-xs uppercase tracking-wide">
                <HelpCircle size={14} className="text-primary" />
                <span>Keyboard Shortcuts</span>
              </div>
              <button 
                onClick={() => setIsOpen(false)}
                className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 cursor-pointer"
              >
                <X size={14} />
              </button>
            </div>

            <div className="flex flex-col gap-4 overflow-y-auto max-h-72 pr-1">
              {shortcutGroups.map((group, groupIdx) => (
                <div key={groupIdx} className="flex flex-col gap-1.5">
                  <span className="text-[10px] font-bold text-slate-400 dark:text-zinc-500 uppercase tracking-widest px-1">
                    {group.title}
                  </span>
                  <div className="flex flex-col gap-1">
                    {group.items.map((item, itemIdx) => {
                      const Icon = item.icon;
                      return (
                        <div 
                          key={itemIdx} 
                          className="flex items-center justify-between text-xs py-1 px-1.5 rounded hover:bg-slate-50 dark:hover:bg-zinc-900 transition"
                        >
                          <div className="flex items-center gap-2 text-slate-600 dark:text-zinc-400">
                            {Icon && <Icon size={12} className="opacity-70" />}
                            <span className="font-medium text-[11px]">{item.desc}</span>
                          </div>
                          <kbd className="px-1.5 py-0.5 bg-slate-100 dark:bg-zinc-800 border border-slate-200 dark:border-zinc-700 rounded text-[9px] font-mono font-bold text-slate-700 dark:text-zinc-300">
                            {item.key}
                          </kbd>
                        </div>
                      );
                    })}
                  </div>
                </div>
              ))}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};
