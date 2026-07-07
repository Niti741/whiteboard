import { useState, useCallback } from 'react';

/**
 * Custom hook to manage canvas command operations history for local undo/redo actions.
 * Actions are stored as:
 * - Create: { type: 'create', element }
 * - Update: { type: 'update', id, prevChanges, newChanges }
 * - Delete: { type: 'delete', element }
 */
export function useHistory() {
  const [undoStack, setUndoStack] = useState([]);
  const [redoStack, setRedoStack] = useState([]);

  // Pushes a new action onto the history stack and clears redo stack
  const pushAction = useCallback((action) => {
    setUndoStack(prev => [...prev, action]);
    setRedoStack([]); // Clear redo stack on new action
  }, []);

  // Perform an undo operation
  const undo = useCallback((onUndoCallback) => {
    if (undoStack.length === 0) return;

    const action = undoStack[undoStack.length - 1];
    
    // Update stacks sequentially
    setUndoStack(prev => prev.slice(0, -1));
    setRedoStack(prev => [...prev, action]);

    // Revert action logic callback
    if (onUndoCallback && action) {
      switch (action.type) {
        case 'create':
          // Revert creation -> delete it
          onUndoCallback({ type: 'delete', id: action.element.id });
          break;
        case 'delete':
          // Revert deletion -> recreate it
          onUndoCallback({ type: 'create', element: action.element });
          break;
        case 'update':
          // Revert update -> restore prevChanges
          onUndoCallback({ type: 'update', id: action.id, changes: action.prevChanges });
          break;
      }
    }
  }, [undoStack]);

  // Perform a redo operation
  const redo = useCallback((onRedoCallback) => {
    console.log('[History Debug] redo requested. Redo Stack:', redoStack);
    if (redoStack.length === 0) {
      console.log('[History Debug] Redo stack is empty, ignoring.');
      return;
    }

    const action = redoStack[redoStack.length - 1];
    console.log('[History Debug] Target action to redo:', action);

    // Update stacks sequentially
    setRedoStack(prev => prev.slice(0, -1));
    setUndoStack(prev => [...prev, action]);

    // Replay action logic callback
    if (onRedoCallback && action) {
      console.log('[History Debug] Triggering callback for action type:', action.type);
      switch (action.type) {
        case 'create':
          onRedoCallback({ type: 'create', element: action.element });
          break;
        case 'delete':
          onRedoCallback({ type: 'delete', id: action.element.id });
          break;
        case 'update':
          onRedoCallback({ type: 'update', id: action.id, changes: action.newChanges });
          break;
      }
    }
  }, [redoStack]);

  // Clear history state
  const clearHistory = useCallback(() => {
    setUndoStack([]);
    setRedoStack([]);
  }, []);

  return {
    canUndo: undoStack.length > 0,
    canRedo: redoStack.length > 0,
    pushAction,
    undo,
    redo,
    clearHistory
  };
}
