import React from 'react';
import { motion } from 'framer-motion';
import { 
  MousePointer, Pencil, Highlighter, Eraser, 
  Square, Circle, Triangle, Diamond, StickyNote, Minus, ArrowUpRight, Type, Image, Sparkles 
} from 'lucide-react';
import { compressImage } from '../utils/image';

export const Toolbar = ({
  tool,
  setTool,
  color,
  setColor,
  fillColor,
  setFillColor,
  size,
  setSize,
  canvasRef
}) => {
  // Color palette items
  const colors = [
    '#000000', // Black
    '#ffffff', // White
    '#f43f5e', // Rose/Red
    '#f97316', // Orange
    '#eab308', // Yellow
    '#22c55e', // Green
    '#06b6d4', // Cyan
    '#3b82f6', // Blue
    '#a855f7', // Purple
    '#ec4899', // Pink
  ];

  // Tool buttons configuration
  const tools = [
    { id: 'select', label: 'Select Object', icon: MousePointer },
    { id: 'pencil', label: 'Pencil', icon: Pencil },
    { id: 'highlighter', label: 'Highlighter', icon: Highlighter },
    { id: 'eraser', label: 'Eraser', icon: Eraser },
    { id: 'rectangle', label: 'Rectangle', icon: Square },
    { id: 'circle', label: 'Circle', icon: Circle },
    { id: 'triangle', label: 'Triangle', icon: Triangle },
    { id: 'diamond', label: 'Diamond', icon: Diamond },
    { id: 'sticky', label: 'Sticky Note', icon: StickyNote },
    { id: 'line', label: 'Straight Line', icon: Minus },
    { id: 'arrow', label: 'Arrow Line', icon: ArrowUpRight },
    { id: 'text', label: 'Text Box', icon: Type },
    { id: 'laser', label: 'Laser Pointer', icon: Sparkles }
  ];

  // Image Upload handler
  const handleImageUpload = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    try {
      // Compress and resize file
      const { dataUrl, width, height } = await compressImage(file);
      
      // Send image data to canvas for creation
      if (canvasRef.current && canvasRef.current.importImage) {
        canvasRef.current.importImage(dataUrl, width, height);
      }
      
      // Reset input element
      e.target.value = '';
    } catch (err) {
      alert(err.message || 'Failed to import image.');
    }
  };

  return (
    <div className="flex flex-col gap-4 p-3 rounded-2xl glass-panel shadow-2xl w-56 select-none animate-in fade-in slide-in-from-left-4 duration-300">
      
      {/* Drawing Tools Section */}
      <div>
        <span className="text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider block mb-2 px-1">
          whiteboard tools
        </span>
        <div className="grid grid-cols-5 gap-1.5">
          {tools.map((t) => {
            const Icon = t.icon;
            const isActive = tool === t.id;
            return (
              <button
                key={t.id}
                onClick={() => setTool(t.id)}
                title={t.label}
                className={`relative p-2 rounded-lg flex items-center justify-center transition-all duration-300 cursor-pointer hover:scale-110 active:scale-95 z-10 ${
                  isActive 
                    ? 'text-white' 
                    : 'text-slate-600 dark:text-zinc-400 hover:bg-slate-100 dark:hover:bg-slate-800'
                }`}
              >
                {isActive && (
                  <motion.div
                    layoutId="activeToolBubble"
                    className={`absolute inset-0 rounded-lg z-[-1] ${
                      t.id === 'laser' ? 'bg-danger glow-danger' : 'bg-primary glow-primary'
                    }`}
                    transition={{ type: 'spring', stiffness: 350, damping: 28 }}
                  />
                )}
                <Icon size={18} />
              </button>
            );
          })}

          {/* Hidden Image Import Input */}
          <label 
            title="Import Image"
            className="p-2 rounded-lg flex items-center justify-center text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 transition-all duration-200 cursor-pointer"
          >
            <Image size={18} />
            <input 
              type="file" 
              accept="image/*" 
              className="hidden" 
              onChange={handleImageUpload} 
            />
          </label>
        </div>
      </div>

      <hr className="border-slate-200 dark:border-slate-800" />

      {/* Stroke Width Configurator */}
      <div>
        <div className="flex justify-between text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5 px-1">
          <span>Brush Size</span>
          <span className="text-slate-400 font-normal">{size}px</span>
        </div>
        <input
          type="range"
          min="1"
          max="40"
          value={size}
          onChange={(e) => setSize(parseInt(e.target.value))}
          className="w-full accent-sky-500 cursor-pointer"
        />
      </div>

      <hr className="border-slate-200 dark:border-slate-800" />

      {/* Stroke Color Picker */}
      <div>
        <span className="text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider block mb-2 px-1">
          Stroke Color
        </span>
        <div className="grid grid-cols-5 gap-1.5 mb-2">
          {colors.map((c) => {
            const isSelected = color === c;
            return (
              <button
                key={c}
                onClick={() => setColor(c)}
                className={`w-6 h-6 rounded-full border border-slate-200 dark:border-slate-800 transition-transform cursor-pointer ${
                  isSelected ? 'scale-125 ring-2 ring-sky-500 ring-offset-2 dark:ring-offset-slate-900' : 'hover:scale-110'
                }`}
                style={{ backgroundColor: c }}
              />
            );
          })}
        </div>
        <div className="flex gap-2 items-center px-1">
          <input
            type="color"
            value={color}
            onChange={(e) => setColor(e.target.value)}
            className="w-6 h-6 rounded border-0 cursor-pointer bg-transparent"
          />
          <span className="text-xs text-slate-500 dark:text-slate-400 font-mono">
            {color.toUpperCase()}
          </span>
        </div>
      </div>

      {/* Fill Color Picker (Only visible for geometric shapes) */}
      {['rectangle', 'circle', 'triangle', 'diamond', 'sticky'].includes(tool) && (
        <>
          <hr className="border-slate-200 dark:border-slate-800" />
          <div>
            <span className="text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider block mb-2 px-1">
              Fill Color
            </span>
            <div className="grid grid-cols-5 gap-1.5 mb-2">
              {/* Transparent Option */}
              <button
                onClick={() => setFillColor('transparent')}
                className={`w-6 h-6 rounded-full border border-slate-200 dark:border-slate-800 transition-transform cursor-pointer flex items-center justify-center relative bg-slate-100 dark:bg-slate-800 ${
                  fillColor === 'transparent' ? 'scale-125 ring-2 ring-sky-500 ring-offset-2 dark:ring-offset-slate-900' : 'hover:scale-110'
                }`}
              >
                <div className="w-full h-0.5 bg-red-500 rotate-45 absolute" />
              </button>
              
              {colors.map((c) => {
                const isSelected = fillColor === c;
                return (
                  <button
                    key={c}
                    onClick={() => setFillColor(c)}
                    className={`w-6 h-6 rounded-full border border-slate-200 dark:border-slate-800 transition-transform cursor-pointer ${
                      isSelected ? 'scale-125 ring-2 ring-sky-500 ring-offset-2 dark:ring-offset-slate-900' : 'hover:scale-110'
                    }`}
                    style={{ backgroundColor: c }}
                  />
                );
              })}
            </div>
            <div className="flex gap-2 items-center px-1">
              <input
                type="color"
                value={fillColor === 'transparent' ? '#ffffff' : fillColor}
                disabled={fillColor === 'transparent'}
                onChange={(e) => setFillColor(e.target.value)}
                className={`w-6 h-6 rounded border-0 cursor-pointer bg-transparent ${
                  fillColor === 'transparent' ? 'opacity-40' : ''
                }`}
              />
              <span className="text-xs text-slate-500 dark:text-slate-400 font-mono">
                {fillColor === 'transparent' ? 'TRANSPARENT' : fillColor.toUpperCase()}
              </span>
            </div>
          </div>
        </>
      )}
    </div>
  );
};
