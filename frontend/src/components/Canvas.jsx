import React, { useRef, useEffect, useState, useCallback } from 'react';
import { useSocket } from '../context/SocketContext';
import { drawCanvasElement } from '../utils/exports';
import { isPointNearElement, isElementInViewport, uuidv7 } from '../utils/geometry';

export const Canvas = ({
  tool,
  color,
  fillColor,
  size,
  gridEnabled,
  snapToGrid,
  history,
  selectedElementId,
  setSelectedElementId,
  canvasRef,
  pan,
  setPan,
  zoom,
  setZoom
}) => {
  const {
    socket,
    isConnected,
    elements,
    setElements,
    remoteCursors,
    remoteDrawingPreviews,
    emitCreate,
    emitUpdate,
    emitDelete,
    emitCursor,
    emitCursorMetadata,
    emitDrawingPreview
  } = useSocket();

  // Canvas size state
  const [dimensions, setDimensions] = useState({ width: window.innerWidth, height: window.innerHeight });

  // Refs for tracking mouse states
  const isDrawingRef = useRef(false);
  const isPanningRef = useRef(false);
  const spacePressedRef = useRef(false);
  const startMouseRef = useRef({ x: 0, y: 0 });
  const startPanRef = useRef({ x: 0, y: 0 });
  
  // Element drawing properties
  const activeElementIdRef = useRef(null);
  const [activeElement, setActiveElement] = useState(null);
  const activeElementRef = useRef(null);

  // Selection states
  const dragStartRef = useRef({ x: 0, y: 0 });
  const isDraggingElementRef = useRef(false);
  const dragElementStartPosRef = useRef({ x: 0, y: 0 });

  // Text tool overlay state
  const [textInput, setTextInput] = useState(null); // { x, y, wx, wy, text, size, color }

  // Laser Pointer Trails: Array of { id, points: [{x, y, age}], opacity }
  const [laserTrails, setLaserTrails] = useState([]);
  const laserTrailsRef = useRef([]);
  laserTrailsRef.current = laserTrails;

  // Track cursor position throttling
  const lastCursorEmitRef = useRef(0);

  // Keep a ref of elements for key listeners
  const elementsRef = useRef([]);
  elementsRef.current = elements;

  // Double-click text editing refs
  const clickTimeRef = useRef(0);
  const lastClickedIdRef = useRef(null);

  // Handle window resizing
  useEffect(() => {
    const handleResize = () => {
      setDimensions({ width: window.innerWidth, height: window.innerHeight });
    };
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  // Sync cursor metadata tool changes to server
  useEffect(() => {
    if (isConnected) {
      emitCursorMetadata(tool);
    }
  }, [tool, isConnected, emitCursorMetadata]);

  // Translate screen coordinates to world coordinates
  const screenToWorld = useCallback((sx, sy) => {
    return {
      x: (sx - pan.x) / zoom,
      y: (sy - pan.y) / zoom
    };
  }, [pan, zoom]);

  // Translate world coordinates to screen coordinates
  const worldToScreen = useCallback((wx, wy) => {
    return {
      x: wx * zoom + pan.x,
      y: wy * zoom + pan.y
    };
  }, [pan, zoom]);

  // Zoom center calculation helper
  const handleZoom = useCallback((clientX, clientY, factor) => {
    setZoom(prevZoom => {
      const newZoom = Math.max(0.08, Math.min(30, prevZoom * factor));
      
      // Calculate pan offset to keep mouse point anchored in world space
      setPan(prevPan => {
        const mouseWorldX = (clientX - prevPan.x) / prevZoom;
        const mouseWorldY = (clientY - prevPan.y) / prevZoom;
        return {
          x: clientX - mouseWorldX * newZoom,
          y: clientY - mouseWorldY * newZoom
        };
      });

      return newZoom;
    });
  }, []);

  // Zoom / Pan wheel event (Figma & Miro style trackpad and mouse behavior)
  const onWheel = useCallback((e) => {
    e.preventDefault();
    
    if (e.ctrlKey) {
      // Ctrl + scroll zooms centered on cursor
      const factor = e.deltaY < 0 ? 1.1 : 0.9;
      handleZoom(e.clientX, e.clientY, factor);
    } else {
      // Regular scroll pans canvas
      setPan(prevPan => ({
        x: prevPan.x - e.deltaX,
        y: prevPan.y - e.deltaY
      }));
    }
  }, [handleZoom]);

  // Fit to screen / Reset zoom
  const fitToScreen = useCallback(() => {
    setZoom(1);
    setPan({ x: 0, y: 0 });
    setSelectedElementId(null);
  }, [setSelectedElementId]);

  // Expose fitToScreen so parent toolbar can access it
  useEffect(() => {
    if (canvasRef.current) {
      canvasRef.current.fitToScreen = fitToScreen;
      canvasRef.current.setZoom = setZoom;
      canvasRef.current.setPan = setPan;
      canvasRef.current.zoom = zoom;
      canvasRef.current.pan = pan;
    }
  }, [fitToScreen, canvasRef, zoom, pan]);

  // Keyboard shortcut listeners (Space, Delete, Undo/Redo)
  useEffect(() => {
    const handleKeyDown = (e) => {
      // Ignore shortcut when typing in textarea
      if (document.activeElement.tagName === 'TEXTAREA' || document.activeElement.tagName === 'INPUT') {
        return;
      }

      if (e.code === 'Space') {
        spacePressedRef.current = true;
        // Prevent default spacebar scrolling
        e.preventDefault();
      }

      // Delete selected element
      if ((e.key === 'Delete' || e.key === 'Backspace') && selectedElementId) {
        const elementToDelete = elementsRef.current.find(el => el.id === selectedElementId);
        if (elementToDelete) {
          emitDelete(selectedElementId);
          history.pushAction({ type: 'delete', element: elementToDelete });
          setSelectedElementId(null);
        }
      }

      // Ctrl + D to duplicate selected element
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'd' && selectedElementId) {
        e.preventDefault();
        const elementToDuplicate = elementsRef.current.find(el => el.id === selectedElementId);
        if (elementToDuplicate) {
          const newId = uuidv7();
          const duplicated = {
            ...elementToDuplicate,
            id: newId,
            x: elementToDuplicate.x + 25,
            y: elementToDuplicate.y + 25,
            points: elementToDuplicate.points.map(p => ({ x: p.x + 25, y: p.y + 25 })),
            createdAt: new Date(),
            updatedAt: new Date()
          };
          emitCreate(duplicated);
          history.pushAction({ type: 'create', element: duplicated });
          setSelectedElementId(newId);
        }
      }

      // Ctrl + Z / Ctrl + Shift + Z
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'z') {
        e.preventDefault();
        if (e.shiftKey) {
          history.redo((action) => {
            if (action.type === 'create') emitCreate(action.element);
            if (action.type === 'delete') emitDelete(action.id);
            if (action.type === 'update') emitUpdate(action.id, action.changes);
          });
        } else {
          history.undo((action) => {
            if (action.type === 'create') emitCreate(action.element);
            if (action.type === 'delete') emitDelete(action.id);
            if (action.type === 'update') emitUpdate(action.id, action.changes);
          });
        }
      }

      // Ctrl + Y (Redo shortcut)
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'y') {
        e.preventDefault();
        history.redo((action) => {
          if (action.type === 'create') emitCreate(action.element);
          if (action.type === 'delete') emitDelete(action.id);
          if (action.type === 'update') emitUpdate(action.id, action.changes);
        });
        setSelectedElementId(null);
      }
    };

    const handleKeyUp = (e) => {
      if (e.code === 'Space') {
        spacePressedRef.current = false;
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('keyup', handleKeyUp);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('keyup', handleKeyUp);
    };
  }, [selectedElementId, history, emitCreate, emitUpdate, emitDelete, setSelectedElementId]);

  // Laser trail fader animation loop
  useEffect(() => {
    let animId;
    const updateTrails = () => {
      setLaserTrails(prev => {
        return prev
          .map(trail => {
            // Age points
            const updatedPoints = trail.points
              .map(p => ({ ...p, age: p.age + 16 }))
              .filter(p => p.age < 1200); // 1.2s max age

            return {
              ...trail,
              points: updatedPoints,
              opacity: Math.max(0, trail.opacity - 0.015)
            };
          })
          .filter(trail => trail.points.length > 0 && trail.opacity > 0);
      });
      animId = requestAnimationFrame(updateTrails);
    };
    animId = requestAnimationFrame(updateTrails);
    return () => cancelAnimationFrame(animId);
  }, []);

  // Snap to Grid calculations
  const snapPoint = useCallback((val) => {
    if (!snapToGrid) return val;
    const gridSpacing = 25;
    return Math.round(val / gridSpacing) * gridSpacing;
  }, [snapToGrid]);

  // Mouse / Touch / Pointer Down
  const handlePointerDown = (e) => {
    // Only handle left mouse button click
    if (e.button !== 0 && e.button !== 1 && e.pointerType === 'mouse') return;

    // Check if middle click or space key is pressed for panning
    if (e.button === 1 || spacePressedRef.current || tool === 'pan') {
      isPanningRef.current = true;
      startMouseRef.current = { x: e.clientX, y: e.clientY };
      startPanRef.current = { ...pan };
      e.target.setPointerCapture(e.pointerId);
      return;
    }

    const worldPos = screenToWorld(e.clientX, e.clientY);
    const snappedWorldX = snapPoint(worldPos.x);
    const snappedWorldY = snapPoint(worldPos.y);

    // Text tool input creation
    if (tool === 'text') {
      if (textInput) {
        // Complete current text input first
        handleTextSubmit();
      } else {
        setTextInput({
          x: e.clientX,
          y: e.clientY,
          wx: worldPos.x,
          wy: worldPos.y,
          text: '',
          size: size,
          color: color
        });
      }
      return;
    }

    // Selection Dragging Logic
    if (tool === 'select') {
      // Find element clicked (reverse order for top-most selection)
      const clickedEl = [...elementsRef.current]
        .reverse()
        .find(el => isPointNearElement(worldPos.x, worldPos.y, el, 8));

      if (clickedEl) {
        setSelectedElementId(clickedEl.id);

        // Double-click detection for editing text or sticky notes
        const now = Date.now();
        if (clickTimeRef.current && now - clickTimeRef.current < 300 && lastClickedIdRef.current === clickedEl.id) {
          if (clickedEl.type === 'text') {
            const screenPos = worldToScreen(clickedEl.x, clickedEl.y);
            setTextInput({
              x: screenPos.x,
              y: screenPos.y,
              wx: clickedEl.x,
              wy: clickedEl.y,
              text: clickedEl.text,
              size: clickedEl.size,
              color: clickedEl.color,
              editingElementId: clickedEl.id
            });
          } else if (clickedEl.type === 'sticky') {
            const screenCenter = worldToScreen(clickedEl.x + clickedEl.width / 2, clickedEl.y + clickedEl.height / 2);
            setTextInput({
              x: screenCenter.x - 70,
              y: screenCenter.y - 20,
              wx: clickedEl.x,
              wy: clickedEl.y,
              text: clickedEl.text || '',
              size: clickedEl.size,
              color: clickedEl.color,
              targetStickyId: clickedEl.id
            });
          }
        }
        clickTimeRef.current = now;
        lastClickedIdRef.current = clickedEl.id;

        isDraggingElementRef.current = true;
        dragStartRef.current = { x: worldPos.x, y: worldPos.y };
        dragElementStartPosRef.current = { x: clickedEl.x, y: clickedEl.y };
        e.target.setPointerCapture(e.pointerId);
      } else {
        setSelectedElementId(null);
      }
      return;
    }

    // Drawing initialization
    isDrawingRef.current = true;
    e.target.setPointerCapture(e.pointerId);

    const newElementId = uuidv7();
    activeElementIdRef.current = newElementId;

    let initElement = {
      id: newElementId,
      type: tool,
      x: snappedWorldX,
      y: snappedWorldY,
      width: 0,
      height: 0,
      points: [{ x: snappedWorldX, y: snappedWorldY }],
      color: color,
      fillColor: fillColor,
      size: size,
      text: '',
      imageUrl: '',
      createdBy: socket?.id || 'local',
      createdAt: new Date(),
      updatedAt: new Date()
    };

    // Highlighter opacity configuration
    if (tool === 'highlighter') {
      initElement.color = color;
    }

    // Eraser configuration
    if (tool === 'eraser') {
      initElement.color = '#ffffff'; // White default, rendered transparent in canvas
    }

    // Sticky note configuration
    if (tool === 'sticky' && fillColor === 'transparent') {
      initElement.fillColor = '#FEF08A'; // Default warm post-it yellow
    }

    // Laser pointer configuration (handled locally in state, not backend)
    if (tool === 'laser') {
      const newLaserTrail = {
        id: newElementId,
        points: [{ x: worldPos.x, y: worldPos.y, age: 0 }],
        color: '#f43f5e', // Vibrant rose laser color
        opacity: 1
      };
      setLaserTrails(prev => [...prev, newLaserTrail]);
      // Active element becomes this trail reference
      setActiveElement(newLaserTrail);
      activeElementRef.current = newLaserTrail;
      return;
    }

    setActiveElement(initElement);
    activeElementRef.current = initElement;
    emitDrawingPreview(initElement);
  };

  // Mouse / Touch / Pointer Move
  const handlePointerMove = (e) => {
    const worldPos = screenToWorld(e.clientX, e.clientY);

    // Throttle cursor emit (roughly 60 FPS, every 16ms)
    const now = Date.now();
    if (now - lastCursorEmitRef.current > 16) {
      emitCursor(worldPos.x, worldPos.y);
      lastCursorEmitRef.current = now;
    }

    // Handle Panning movement
    if (isPanningRef.current) {
      const dx = e.clientX - startMouseRef.current.x;
      const dy = e.clientY - startMouseRef.current.y;
      setPan({
        x: startPanRef.current.x + dx,
        y: startPanRef.current.y + dy
      });
      return;
    }

    // Handle Selection dragging element
    if (isDraggingElementRef.current && selectedElementId) {
      const dx = worldPos.x - dragStartRef.current.x;
      const dy = worldPos.y - dragStartRef.current.y;

      const currentEl = elementsRef.current.find(el => el.id === selectedElementId);
      if (currentEl) {
        let snappedDx = snapPoint(dragElementStartPosRef.current.x + dx) - dragElementStartPosRef.current.x;
        let snappedDy = snapPoint(dragElementStartPosRef.current.y + dy) - dragElementStartPosRef.current.y;

        const updatedChanges = {
          x: dragElementStartPosRef.current.x + snappedDx,
          y: dragElementStartPosRef.current.y + snappedDy
        };

        // Update locally for ultra-smooth responsiveness
        setElements(prev => prev.map(el => el.id === selectedElementId ? { ...el, ...updatedChanges } : el));
        // Ephemeral dragging preview to others
        const dragPreview = { ...currentEl, ...updatedChanges };
        emitDrawingPreview(dragPreview);
      }
      return;
    }

    // Handle Active Drawing updates
    if (!isDrawingRef.current || !activeElement) return;

    if (tool === 'laser') {
      // Append points to local laser trail
      setLaserTrails(prev => prev.map(trail => {
        if (trail.id === activeElementIdRef.current) {
          const updated = {
            ...trail,
            points: [...trail.points, { x: worldPos.x, y: worldPos.y, age: 0 }],
            opacity: 1
          };
          activeElementRef.current = updated;
          return updated;
        }
        return trail;
      }));
      return;
    }

    const snappedWorldX = snapPoint(worldPos.x);
    const snappedWorldY = snapPoint(worldPos.y);

    setActiveElement(prev => {
      if (!prev) return null;
      
      const width = snappedWorldX - prev.x;
      const height = snappedWorldY - prev.y;
      const nextPoints = [...prev.points, { x: worldPos.x, y: worldPos.y }];

      let updated = { ...prev, updatedAt: new Date() };

      if (tool === 'pencil' || tool === 'highlighter' || tool === 'eraser') {
        updated.points = nextPoints;
      } else {
        // Shapes, line, arrow
        updated.width = width;
        updated.height = height;
      }

      // Broadcast real-time preview (throttled inside socket emitter)
      emitDrawingPreview(updated);
      activeElementRef.current = updated;
      return updated;
    });
  };

  // Mouse / Touch / Pointer Up
  const handlePointerUp = (e) => {
    if (isPanningRef.current) {
      isPanningRef.current = false;
      e.target.releasePointerCapture(e.pointerId);
      return;
    }

    // Complete dragging selection element
    if (isDraggingElementRef.current && selectedElementId) {
      isDraggingElementRef.current = false;
      e.target.releasePointerCapture(e.pointerId);
      
      const completedEl = elementsRef.current.find(el => el.id === selectedElementId);
      if (completedEl) {
        const prevChanges = { x: dragElementStartPosRef.current.x, y: dragElementStartPosRef.current.y };
        const newChanges = { x: completedEl.x, y: completedEl.y };

        // Save element updates permanently to server database
        emitUpdate(selectedElementId, newChanges);
        emitDrawingPreview(null); // Clear dragging preview

        // Log operation command to history stack
        if (prevChanges.x !== newChanges.x || prevChanges.y !== newChanges.y) {
          history.pushAction({
            type: 'update',
            id: selectedElementId,
            prevChanges,
            newChanges
          });
        }
      }
      return;
    }

    if (!isDrawingRef.current) return;
    isDrawingRef.current = false;
    e.target.releasePointerCapture(e.pointerId);

    if (tool === 'laser') {
      setActiveElement(null);
      activeElementIdRef.current = null;
      return;
    }

    const finalElement = activeElementRef.current;

    if (finalElement) {
      // Filter out small clicks/taps for lines/shapes to prevent tiny debris
      const isPath = ['pencil', 'highlighter', 'eraser'].includes(finalElement.type);
      const hasLength = isPath ? finalElement.points.length > 2 : Math.hypot(finalElement.width, finalElement.height) > 4;

      if (hasLength) {
        // Persist completed element to MongoDB
        emitCreate(finalElement);
        // Log operation command
        history.pushAction({ type: 'create', element: finalElement });

        if (finalElement.type === 'sticky') {
          const screenCenter = worldToScreen(finalElement.x + finalElement.width / 2, finalElement.y + finalElement.height / 2);
          setTextInput({
            x: screenCenter.x - 70,
            y: screenCenter.y - 20,
            wx: finalElement.x,
            wy: finalElement.y,
            text: '',
            size: size,
            color: color,
            targetStickyId: finalElement.id
          });
        }
      } else {
        // Rollback local optimistic UI addition
        setElements(prev => prev.filter(el => el.id !== finalElement.id));
      }
    }

    // Reset states
    setActiveElement(null);
    activeElementRef.current = null;
    activeElementIdRef.current = null;
    emitDrawingPreview(null);
  };

  // Submit typed text overlay
  const handleTextSubmit = () => {
    if (!textInput) return;

    // A. Update existing sticky note text
    if (textInput.targetStickyId) {
      const stickyEl = elementsRef.current.find(el => el.id === textInput.targetStickyId);
      if (stickyEl) {
        const textVal = textInput.text.trim();
        const newChanges = { text: textVal };
        emitUpdate(textInput.targetStickyId, newChanges);
        history.pushAction({
          type: 'update',
          id: textInput.targetStickyId,
          prevChanges: { text: stickyEl.text || '' },
          newChanges
        });
        setElements(prev => prev.map(el => el.id === textInput.targetStickyId ? { ...el, ...newChanges } : el));
      }
      setTextInput(null);
      return;
    }

    // B. Update existing text element
    if (textInput.editingElementId) {
      const textEl = elementsRef.current.find(el => el.id === textInput.editingElementId);
      if (textEl) {
        const textVal = textInput.text.trim();
        if (textVal) {
          const newChanges = { text: textVal };
          emitUpdate(textInput.editingElementId, newChanges);
          history.pushAction({
            type: 'update',
            id: textInput.editingElementId,
            prevChanges: { text: textEl.text },
            newChanges
          });
          setElements(prev => prev.map(el => el.id === textInput.editingElementId ? { ...el, ...newChanges } : el));
        } else {
          emitDelete(textInput.editingElementId);
          history.pushAction({ type: 'delete', element: textEl });
        }
      }
      setTextInput(null);
      return;
    }

    // C. Create new text element
    if (!textInput.text.trim()) {
      setTextInput(null);
      return;
    }

    // Calculate dynamic textbox width and height for selection detection
    const lines = textInput.text.split('\n');
    const fontSize = textInput.size * 4 + 14;
    const lineHeight = fontSize + 6;
    
    // Estimate width based on characters count
    const maxLengthLine = lines.reduce((max, line) => line.length > max.length ? line : max, '');
    const estimatedWidth = maxLengthLine.length * (fontSize * 0.6);
    const estimatedHeight = lines.length * lineHeight;

    const newTextElement = {
      id: uuidv7(),
      type: 'text',
      x: textInput.wx,
      y: textInput.wy,
      width: estimatedWidth,
      height: estimatedHeight,
      points: [],
      color: textInput.color,
      fillColor: 'transparent',
      size: textInput.size,
      text: textInput.text,
      imageUrl: '',
      createdBy: socket?.id || 'local',
      createdAt: new Date(),
      updatedAt: new Date()
    };

    emitCreate(newTextElement);
    history.pushAction({ type: 'create', element: newTextElement });
    setTextInput(null);
  };

  // Handle image import triggers
  const handleImageImport = useCallback((dataUrl, imgWidth, imgHeight) => {
    // Put image at center of current screen view in world coordinates
    const centerX = window.innerWidth / 2;
    const centerY = window.innerHeight / 2;
    const worldCenter = screenToWorld(centerX, centerY);

    // Resize image bounds on screen (e.g. max width 600px, scaled)
    let displayWidth = imgWidth;
    let displayHeight = imgHeight;
    const maxDisplaySize = 600;

    if (displayWidth > maxDisplaySize || displayHeight > maxDisplaySize) {
      if (displayWidth > displayHeight) {
        displayHeight = Math.round((displayHeight * maxDisplaySize) / displayWidth);
        displayWidth = maxDisplaySize;
      } else {
        displayWidth = Math.round((displayWidth * maxDisplaySize) / displayHeight);
        displayHeight = maxDisplaySize;
      }
    }

    const newImageElement = {
      id: uuidv7(),
      type: 'image',
      x: snapPoint(worldCenter.x - displayWidth / 2),
      y: snapPoint(worldCenter.y - displayHeight / 2),
      width: displayWidth,
      height: displayHeight,
      points: [],
      color: '#ffffff',
      fillColor: 'transparent',
      size: 1,
      text: '',
      imageUrl: dataUrl,
      createdBy: socket?.id || 'local',
      createdAt: new Date(),
      updatedAt: new Date()
    };

    emitCreate(newImageElement);
    history.pushAction({ type: 'create', element: newImageElement });
  }, [screenToWorld, snapPoint, socket, emitCreate, history]);

  // Bind trigger handle to DOM element for imports communication
  useEffect(() => {
    if (canvasRef.current) {
      canvasRef.current.importImage = handleImageImport;
    }
  }, [handleImageImport, canvasRef]);

  // Main Canvas Rendering Loop
  useEffect(() => {
    const canvas = document.getElementById('whiteboard-canvas');
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    let animationId;

    const render = () => {
      // Clear screen
      ctx.clearRect(0, 0, dimensions.width, dimensions.height);

      ctx.save();
      // Apply translation matrix for panning and zooming
      ctx.translate(pan.x, pan.y);
      ctx.scale(zoom, zoom);

      // A. DRAW BACKGROUND GRID
      if (gridEnabled) {
        ctx.save();
        ctx.strokeStyle = document.documentElement.classList.contains('dark') ? 'rgba(255, 255, 255, 0.07)' : 'rgba(0, 0, 0, 0.05)';
        ctx.lineWidth = 0.5 / zoom;

        const gridSpacing = 50;
        
        // Calculate viewport boundaries in world space to draw grid lines only where visible
        const startX = Math.floor((-pan.x / zoom) / gridSpacing) * gridSpacing - gridSpacing;
        const endX = Math.ceil((dimensions.width - pan.x) / zoom / gridSpacing) * gridSpacing + gridSpacing;
        const startY = Math.floor((-pan.y / zoom) / gridSpacing) * gridSpacing - gridSpacing;
        const endY = Math.ceil((dimensions.height - pan.y) / zoom / gridSpacing) * gridSpacing + gridSpacing;

        // Draw vertical lines
        for (let x = startX; x < endX; x += gridSpacing) {
          ctx.beginPath();
          ctx.moveTo(x, startY);
          ctx.lineTo(x, endY);
          ctx.stroke();
        }

        // Draw horizontal lines
        for (let y = startY; y < endY; y += gridSpacing) {
          ctx.beginPath();
          ctx.moveTo(startX, y);
          ctx.lineTo(endX, y);
          ctx.stroke();
        }
        ctx.restore();
      }

      // Calculate viewport boundaries for elements culling
      const minX = -pan.x / zoom;
      const minY = -pan.y / zoom;
      const maxX = (dimensions.width - pan.x) / zoom;
      const maxY = (dimensions.height - pan.y) / zoom;

      // B. RENDER COMPLETED CANVAS ELEMENTS (With Viewport Culling)
      elements.forEach(el => {
        // Culling optimization: Skip rendering elements fully outside the screen bounds
        if (!isElementInViewport(el, minX, minY, maxX, maxY)) return;
        
        // Custom rendering for eraser elements
        if (el.type === 'eraser') {
          // Temporarily override eraser stroke to match theme background color
          const origColor = el.color;
          el.color = document.documentElement.classList.contains('dark') ? '#0B1020' : '#FCFCFF';
          drawCanvasElement(ctx, el);
          el.color = origColor;
        } else {
          drawCanvasElement(ctx, el);
        }
      });

      // C. RENDER ACTIVE LOCAL DRAWING LAYER
      if (isDrawingRef.current && activeElement && tool !== 'laser') {
        drawCanvasElement(ctx, activeElement);
      }

      // D. RENDER ACTIVE REMOTE DRAWINGS
      Object.keys(remoteDrawingPreviews).forEach(userId => {
        const preview = remoteDrawingPreviews[userId];
        if (preview) {
          if (preview.type === 'eraser') {
            const origColor = preview.color;
            preview.color = document.documentElement.classList.contains('dark') ? '#0B1020' : '#FCFCFF';
            drawCanvasElement(ctx, preview);
            preview.color = origColor;
          } else {
            drawCanvasElement(ctx, preview);
          }
        }
      });

      // E. RENDER SELECTION OUTLINES & HANDLES (Marching Ants Selection)
      if (tool === 'select' && selectedElementId) {
        const selectedEl = elements.find(el => el.id === selectedElementId);
        if (selectedEl) {
          ctx.save();
          ctx.strokeStyle = '#3B82F6'; // Brand Selection color
          ctx.lineWidth = 1.5 / zoom;
          
          // Animate line dash offset using live ticks
          ctx.setLineDash([5 / zoom, 5 / zoom]);
          ctx.lineDashOffset = -(Date.now() / 60) / zoom;
 
          if (['pencil', 'highlighter', 'eraser'].includes(selectedEl.type)) {
            // Complex path bounds check
            let sMinX = Infinity, sMinY = Infinity, sMaxX = -Infinity, sMaxY = -Infinity;
            selectedEl.points.forEach(p => {
              if (p.x < sMinX) sMinX = p.x;
              if (p.y < sMinY) sMinY = p.y;
              if (p.x > sMaxX) sMaxX = p.x;
              if (p.y > sMaxY) sMaxY = p.y;
            });
            ctx.strokeRect(sMinX - 4, sMinY - 4, (sMaxX - sMinX) + 8, (sMaxY - sMinY) + 8);
          } else {
            // Shapes / Line bounds
            ctx.strokeRect(
              Math.min(selectedEl.x, selectedEl.x + selectedEl.width) - 4,
              Math.min(selectedEl.y, selectedEl.y + selectedEl.height) - 4,
              Math.abs(selectedEl.width) + 8,
              Math.abs(selectedEl.height) + 8
            );
          }
          ctx.restore();
        }
      }

      // F. RENDER LOCAL LASER TRAILS
      laserTrailsRef.current.forEach(trail => {
        if (trail.points.length < 2) return;
        ctx.save();
        ctx.strokeStyle = trail.color;
        ctx.lineWidth = 6 / zoom;
        ctx.lineCap = 'round';
        ctx.lineJoin = 'round';
        ctx.shadowBlur = 10;
        ctx.shadowColor = trail.color;
        ctx.globalAlpha = trail.opacity;

        ctx.beginPath();
        ctx.moveTo(trail.points[0].x, trail.points[0].y);
        for (let i = 1; i < trail.points.length; i++) {
          ctx.lineTo(trail.points[i].x, trail.points[i].y);
        }
        ctx.stroke();
        ctx.restore();
      });

      // G. RENDER REMOTE COLLABORATORS' CURSORS
      Object.keys(remoteCursors).forEach(userId => {
        const cursor = remoteCursors[userId];
        if (!cursor || typeof cursor.x === 'undefined') return;

        ctx.save();
        // Translate to cursor world position
        ctx.translate(cursor.x, cursor.y);

        // Draw pointer cursor body
        ctx.fillStyle = cursor.color || '#ff4500';
        ctx.strokeStyle = '#ffffff';
        ctx.lineWidth = 1.5 / zoom;
        
        ctx.beginPath();
        ctx.moveTo(0, 0);
        ctx.lineTo(0, 16 / zoom);
        ctx.lineTo(4 / zoom, 12 / zoom);
        ctx.lineTo(9 / zoom, 12 / zoom);
        ctx.closePath();
        ctx.fill();
        ctx.stroke();

        // Draw username label tag
        ctx.fillStyle = cursor.color || '#ff4500';
        ctx.font = `${10 / zoom}px var(--font-sans)`;
        const textWidth = ctx.measureText(cursor.username || 'Collaborator').width;
        
        ctx.fillRect(12 / zoom, 12 / zoom, (textWidth + 8) / zoom, 15 / zoom);
        
        ctx.fillStyle = '#ffffff';
        ctx.fillText(cursor.username || 'Collaborator', 16 / zoom, 23 / zoom);
        ctx.restore();
      });

      ctx.restore();
      animationId = requestAnimationFrame(render);
    };

    animationId = requestAnimationFrame(render);
    return () => cancelAnimationFrame(animationId);
  }, [elements, pan, zoom, gridEnabled, dimensions, tool, selectedElementId, remoteCursors, remoteDrawingPreviews]);

  // Set local state while typing text
  const handleTextChange = (e) => {
    setTextInput(prev => ({
      ...prev,
      text: e.target.value
    }));
  };

  return (
    <div 
      className="canvas-container select-none cursor-crosshair bg-slate-50 dark:bg-[#020617]"
      style={{ cursor: tool === 'select' ? 'default' : (isPanningRef.current ? 'grabbing' : 'crosshair') }}
      onWheel={onWheel}
    >
      <canvas
        id="whiteboard-canvas"
        width={dimensions.width}
        height={dimensions.height}
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        className="block"
      />

      {/* Input Overlay Textarea for Text Tool */}
      {textInput && (
        <div
          className="absolute z-50 pointer-events-auto"
          style={{
            left: textInput.x,
            top: textInput.y
          }}
        >
          <textarea
            autoFocus
            rows={1}
            value={textInput.text}
            onChange={handleTextChange}
            onBlur={handleTextSubmit}
            onKeyDown={(e) => {
              // Press enter without shift to submit text element
              if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                handleTextSubmit();
              }
            }}
            placeholder="Type text..."
            style={{
              fontSize: `${(textInput.size * 4 + 14) * zoom}px`,
              color: textInput.color,
              lineHeight: 1.2
            }}
            className="p-1 border border-sky-500 bg-white/95 dark:bg-slate-900/95 outline-none rounded shadow-md resize font-sans"
          />
        </div>
      )}
    </div>
  );
};
