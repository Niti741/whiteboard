import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  Undo2, Redo2, ZoomIn, ZoomOut, Maximize, 
  Grid, Magnet, Sun, Moon, Download, Upload, 
  Copy, Check, Trash2, Users, LogOut 
} from 'lucide-react';
import { useSocket } from '../context/SocketContext';
import { exportToPNG, exportToSVG, exportToPDF, exportToJSON, importFromJSON } from '../utils/exports';

export const Topbar = ({
  gridEnabled,
  setGridEnabled,
  snapToGrid,
  setSnapToGrid,
  history,
  selectedElementId,
  setSelectedElementId,
  canvasRef,
  isDarkMode,
  setIsDarkMode,
  showToast,
  zoom,
  setZoom,
  setPan
}) => {
  const { 
    roomId, 
    users, 
    elements, 
    emitClear, 
    emitCreate, 
    emitDelete,
    emitUpdate,
    leaveRoom,
    setElements 
  } = useSocket();

  const [copied, setCopied] = useState(false);
  const [exportOpen, setExportOpen] = useState(false);

  // Copy shareable link handler
  const handleCopyLink = () => {
    const link = `${window.location.origin}?room=${roomId}`;
    navigator.clipboard.writeText(link).then(() => {
      setCopied(true);
      showToast('Invite link copied to clipboard!', 'success');
      setTimeout(() => setCopied(false), 2000);
    });
  };

  // Clear whiteboard canvas handler
  const handleClearBoard = async () => {
    if (window.confirm('Are you sure you want to clear the entire whiteboard? This cannot be undone.')) {
      try {
        await emitClear();
        history.clearHistory();
        setSelectedElementId(null);
        showToast('Whiteboard cleared successfully!', 'success');
      } catch (err) {
        showToast('Failed to clear whiteboard.', 'error');
      }
    }
  };

  // Zoom controls
  const handleZoomIn = () => {
    setZoom(z => Math.min(30, z * 1.2));
  };

  const handleZoomOut = () => {
    setZoom(z => Math.max(0.08, z * 0.8));
  };

  const handleZoomReset = () => {
    setZoom(1);
    setPan({ x: 0, y: 0 });
  };

  // JSON Backup Import handler
  const handleImportJSON = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (window.confirm('Importing backup will clear the current board. Do you want to proceed?')) {
      try {
        showToast('Restoring board from backup...', 'warning');
        const importedElements = await importFromJSON(file);
        
        // 1. Clear current canvas
        await emitClear();
        history.clearHistory();
        setSelectedElementId(null);
        
        // 2. Load imported elements
        // Send create event for each element to sync database and other users
        for (const el of importedElements) {
          await emitCreate(el);
        }

        showToast('Whiteboard restored successfully!', 'success');
      } catch (err) {
        showToast(err.message || 'Failed to import JSON backup.', 'error');
      } finally {
        e.target.value = ''; // Reset input element
      }
    }
  };

  // Theme Toggler
  const toggleTheme = () => {
    const nextDark = !isDarkMode;
    setIsDarkMode(nextDark);
    if (nextDark) {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }
  };

  return (
    <div className="w-full flex items-center justify-between p-3 rounded-2xl glass-panel shadow-lg select-none animate-in fade-in slide-in-from-top-4 duration-300">
      
      {/* 1. ROOM & IDENTITY INFO */}
      <div className="flex items-center gap-3">
        <div className="flex flex-col">
          <div className="flex items-center gap-1.5">
            <span className="text-sm font-bold text-slate-800 dark:text-white">
              {roomId === 'personal-board' ? (
                <>Board: <span className="font-heading text-amber-500 font-semibold">Private Board</span></>
              ) : (
                <>Room: <span className="font-mono text-sky-500">{roomId}</span></>
              )}
            </span>
            {roomId !== 'personal-board' && (
              <button 
                onClick={handleCopyLink}
                title="Copy Invite Link"
                className="p-1 rounded text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition cursor-pointer"
              >
                {copied ? <Check size={14} className="text-green-500" /> : <Copy size={14} />}
              </button>
            )}
          </div>
          <div className="flex items-center gap-1 text-[11px] text-slate-400 font-medium">
            <Users size={12} />
            <span>{roomId === 'personal-board' ? 'Private Solo Session' : `${users.length} user${users.length === 1 ? '' : 's'} online`}</span>
          </div>
        </div>
      </div>

      {/* 2. UNDO, REDO & CANVAS ACTION BUTTONS */}
      <div className="flex items-center gap-2">
        <button
          onClick={() => history.undo((action) => {
            if (action.type === 'create') emitCreate(action.element);
            if (action.type === 'delete') emitDelete(action.id);
            if (action.type === 'update') emitUpdate(action.id, action.changes);
          })}
          disabled={!history.canUndo}
          title="Undo (Ctrl + Z)"
          className={`p-2 rounded-lg flex items-center justify-center transition cursor-pointer ${
            history.canUndo 
              ? 'text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800' 
              : 'text-slate-300 dark:text-slate-700 cursor-not-allowed opacity-50'
          }`}
        >
          <Undo2 size={16} />
        </button>
        <button
          onClick={() => history.redo((action) => {
            if (action.type === 'create') emitCreate(action.element);
            if (action.type === 'delete') emitDelete(action.id);
            if (action.type === 'update') emitUpdate(action.id, action.changes);
          })}
          disabled={!history.canRedo}
          title="Redo (Ctrl + Shift + Z)"
          className={`p-2 rounded-lg flex items-center justify-center transition cursor-pointer ${
            history.canRedo 
              ? 'text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800' 
              : 'text-slate-300 dark:text-slate-700 cursor-not-allowed opacity-50'
          }`}
        >
          <Redo2 size={16} />
        </button>

        <div className="w-px h-5 bg-slate-200 dark:bg-slate-800 mx-1" />

        {/* Clear Board */}
        <button
          onClick={handleClearBoard}
          title="Clear Entire Whiteboard"
          className="p-2 rounded-lg flex items-center justify-center text-red-500 hover:bg-red-50 dark:hover:bg-red-950/30 transition cursor-pointer"
        >
          <Trash2 size={16} />
        </button>
      </div>

      {/* 3. ZOOM CONTROLS */}
      <div className="flex items-center gap-2 bg-slate-100 dark:bg-slate-900 px-2.5 py-1 rounded-lg">
        <button 
          onClick={handleZoomOut} 
          title="Zoom Out"
          className="p-1 rounded hover:bg-slate-200 dark:hover:bg-slate-800 text-slate-600 dark:text-slate-400 cursor-pointer"
        >
          <ZoomOut size={14} />
        </button>
        <button 
          onClick={handleZoomReset}
          title="Fit / Reset Zoom"
          className="text-xs font-mono font-bold text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 cursor-pointer min-w-12 text-center"
        >
          {Math.round(zoom * 100)}%
        </button>
        <button 
          onClick={handleZoomIn} 
          title="Zoom In"
          className="p-1 rounded hover:bg-slate-200 dark:hover:bg-slate-800 text-slate-600 dark:text-slate-400 cursor-pointer"
        >
          <ZoomIn size={14} />
        </button>
        <button 
          onClick={handleZoomReset} 
          title="Fit to Screen"
          className="p-1 rounded hover:bg-slate-200 dark:hover:bg-slate-800 text-slate-400 hover:text-slate-600 cursor-pointer"
        >
          <Maximize size={13} />
        </button>
      </div>

      {/* 4. SETTINGS & UTILITIES TOGGLES */}
      <div className="flex items-center gap-2">
        {/* Grid Toggle */}
        <button
          onClick={() => setGridEnabled(g => !g)}
          title={gridEnabled ? "Disable Grid" : "Enable Grid"}
          className={`p-2 rounded-lg flex items-center justify-center transition cursor-pointer ${
            gridEnabled 
              ? 'bg-sky-100 text-sky-600 dark:bg-sky-950/40 dark:text-sky-400' 
              : 'text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800'
          }`}
        >
          <Grid size={16} />
        </button>

        {/* Snap to Grid */}
        <button
          onClick={() => setSnapToGrid(s => !s)}
          title={snapToGrid ? "Disable Snap to Grid" : "Enable Snap to Grid"}
          className={`p-2 rounded-lg flex items-center justify-center transition cursor-pointer ${
            snapToGrid 
              ? 'bg-sky-100 text-sky-600 dark:bg-sky-950/40 dark:text-sky-400' 
              : 'text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800'
          }`}
        >
          <Magnet size={16} />
        </button>

        {/* Theme Toggle with Crossfade */}
        <button
          onClick={toggleTheme}
          title={isDarkMode ? "Switch to Light Mode" : "Switch to Dark Mode"}
          className="p-2 rounded-lg flex items-center justify-center text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800 transition cursor-pointer hover:scale-105 active:scale-95"
        >
          <AnimatePresence mode="wait" initial={false}>
            <motion.div
              key={isDarkMode ? 'dark' : 'light'}
              initial={{ y: -10, opacity: 0, rotate: -45 }}
              animate={{ y: 0, opacity: 1, rotate: 0 }}
              exit={{ y: 10, opacity: 0, rotate: 45 }}
              transition={{ duration: 0.15 }}
            >
              {isDarkMode ? <Sun size={16} className="text-yellow-400" /> : <Moon size={16} />}
            </motion.div>
          </AnimatePresence>
        </button>

        <div className="w-px h-5 bg-slate-200 dark:bg-slate-800 mx-1" />

        {/* Export / Import Panel */}
        <div className="relative">
          <button
            onClick={() => setExportOpen(!exportOpen)}
            title="Export / Backups"
            className={`p-2 rounded-lg flex items-center gap-1 text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition cursor-pointer ${
              exportOpen ? 'bg-slate-100 dark:bg-slate-800' : ''
            }`}
          >
            <Download size={16} />
            <span className="text-xs font-semibold">Save Board</span>
          </button>

          <AnimatePresence>
            {exportOpen && (
              <motion.div
                initial={{ opacity: 0, y: -15, scale: 0.95 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                exit={{ opacity: 0, y: -15, scale: 0.95 }}
                transition={{ type: 'spring', damping: 20, stiffness: 200 }}
                className="absolute right-0 mt-2 w-48 rounded-xl glass-panel shadow-2xl p-2 z-50 flex flex-col gap-1 text-sm text-slate-700 dark:text-zinc-200"
              >
                <button
                  onClick={() => {
                    showToast('Exporting canvas as PNG...', 'warning');
                    setTimeout(() => {
                      exportToPNG(elements, roomId, isDarkMode);
                      showToast('PNG image downloaded!', 'success');
                    }, 400);
                    setExportOpen(false);
                  }}
                  className="w-full text-left px-3 py-2 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 transition cursor-pointer"
                >
                  Export as PNG Image
                </button>
                <button
                  onClick={() => {
                    showToast('Exporting canvas as SVG...', 'warning');
                    setTimeout(() => {
                      exportToSVG(elements, roomId, isDarkMode);
                      showToast('SVG vector downloaded!', 'success');
                    }, 400);
                    setExportOpen(false);
                  }}
                  className="w-full text-left px-3 py-2 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 transition cursor-pointer"
                >
                  Export as SVG Vector
                </button>
                <button
                  onClick={() => {
                    showToast('Compiling canvas into PDF...', 'warning');
                    setTimeout(() => {
                      exportToPDF(elements, roomId, isDarkMode);
                      showToast('PDF document downloaded!', 'success');
                    }, 600);
                    setExportOpen(false);
                  }}
                  className="w-full text-left px-3 py-2 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 transition cursor-pointer"
                >
                  Export as PDF Document
                </button>
                
                <hr className="border-slate-200 dark:border-slate-800 my-1" />

                <button
                  onClick={() => {
                    showToast('Creating JSON backup...', 'warning');
                    setTimeout(() => {
                      exportToJSON(elements, roomId);
                      showToast('JSON backup downloaded!', 'success');
                    }, 300);
                    setExportOpen(false);
                  }}
                  className="w-full text-left px-3 py-2 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 transition cursor-pointer"
                >
                  Export JSON Backup
                </button>
                
                <label className="w-full text-left px-3 py-2 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 transition cursor-pointer flex items-center justify-between">
                  <span>Import JSON Backup</span>
                  <Upload size={14} className="text-slate-400" />
                  <input
                    type="file"
                    accept=".json"
                    className="hidden"
                    onChange={(e) => { handleImportJSON(e); setExportOpen(false); }}
                  />
                </label>
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        {/* Exit Room */}
        <button
          onClick={leaveRoom}
          title="Leave Room"
          className="p-2 rounded-lg flex items-center justify-center text-red-500 hover:bg-red-50 dark:hover:bg-red-950/20 transition cursor-pointer"
        >
          <LogOut size={16} />
        </button>
      </div>

    </div>
  );
};
