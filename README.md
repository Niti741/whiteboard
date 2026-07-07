# CoDraw - Real-Time Collaborative Vector Whiteboard

CoDraw is a production-ready, full-stack, real-time collaborative whiteboard application. It enables multiple users to draw, write text, and upload images together on an infinite grid canvas with sub-millisecond drawing latency and auto-reconnection resilience.

---

## 🎨 Core Features

1. **Real-Time Synchronisation**: Dynamic drawing sharing and live collaborator cursors (labeled with usernames and custom cursor colors) powered by Socket.IO.
2. **Infinite Canvas**: Grid background that zooms (centered on mouse wheel) and pans (spacebar + drag, or middle-mouse drag) endlessly.
3. **Whiteboard Toolset**:
   - Vector drawing: Pencil (freehand), Highlighter (rgba opacity), Eraser (composite destination-out masking).
   - Vector shapes: Rectangle, Circle, Straight Line, and Arrow.
   - Text boxes: Interactive overlays with multi-line input support.
   - Laser pointer: Temporary glowing cursor paths that automatically fade out.
   - Image Imports: Upload and place images on the board.
4. **Performance Optimisations**:
   - **Viewport Culling**: Translate canvas screen boundaries back to world-space coordinates. Filter elements using axis-aligned bounding box (AABB) intersections, rendering only visible elements to keep 60 FPS performance even with thousands of objects.
   - **Throttling**: Live movement events (mouse cursors, draw previews) are throttled to ~60 FPS (16ms interval) to minimize network bandwidth.
   - **Client-Side Processing**: Images are resized (max 1920px) and converted to WebP on the client side before socket broadcast to keep MongoDB records lightweight.
5. **Local Command History (Undo/Redo)**:
   - Built using a local command pattern that enables undoing and redoing *only* the current user's own actions (Create, Update, Delete) to avoid conflicting with concurrent edits.
6. **Selection & Editing**:
   - Selection tool to select vector items on click, drag to move them, and click `Delete`/`Backspace` to remove.
7. **Whiteboard Backups & Exports**:
   - Save drawing spaces to standard PNG image, vector SVG, print-ready PDF, or download a complete JSON backup of the board state.
   - Load JSON files to restore the board state.
8. **Dark & Light Themes**: Sleek, theme-aware canvas colors and user toolbars.

---

## 💻 Tech Stack

### Frontend
- **React.js** (Vite build system)
- **HTML5 Canvas** (Dynamic layering system)
- **Tailwind CSS v4** (CSS variable-based theming, zero configuration build plugin)
- **Socket.IO Client**

### Backend
- **Node.js & Express.js**
- **Socket.IO** (Heartbeats, room namespaces, error handlers)
- **MongoDB & Mongoose** (Optional persistent storage)

---

## 📁 Project Directory Structure

```text
whiteboard/
├── backend/
│   ├── package.json
│   ├── server.js               # Node/Express server + Socket.IO lifecycle handlers
│   ├── .env.example            # Environment variables configuration template
│   └── models/
│       └── Board.js            # MongoDB schema with explicit element sub-schema
└── frontend/
    ├── package.json
    ├── vite.config.js          # Tailwind CSS v4 compiler configurations
    ├── index.html              # HTML entry point (Outfit/Inter fonts)
    └── src/
        ├── main.jsx
        ├── App.jsx             # Switchboard: Splash Screen (RoomPanel) vs Board (Whiteboard)
        ├── index.css           # Tailwind imports + animation styles
        ├── components/
        │   ├── Whiteboard.jsx  # Main coordinate container
        │   ├── Canvas.jsx      # Mouse/Touch coordinates rendering engine
        │   ├── Toolbar.jsx     # Tool select, brush size, color pickers
        │   ├── Topbar.jsx      # Undo/Redo, Zoom, Grid, backup exporters
        │   ├── RoomPanel.jsx   # Create/Join splash screen
        │   └── UsersList.jsx   # Online participant presence lists
        ├── context/
        │   └── SocketContext.jsx # Socket events emitter & sync wrapper
        ├── hooks/
        │   └── useHistory.js   # Command pattern undo/redo stack
        └── utils/
            ├── geometry.js     # Intersection checks, arrow drawing, UUIDv7 generator
            ├── image.js        # WebP canvas compression & limit checks
            └── exports.js      # PNG, SVG, PDF, and JSON backups exporters
```

---

## 📊 Database Schema details

The schema (`backend/models/Board.js`) defines a structured, typed Mongoose sub-schema for whiteboard elements, ensuring integrity and version increments.

```javascript
const ElementSchema = new mongoose.Schema({
  id: { type: String, required: true },
  type: { type: String, required: true },
  x: { type: Number, default: 0 },
  y: { type: Number, default: 0 },
  width: { type: Number, default: 0 },
  height: { type: Number, default: 0 },
  points: [{ x: Number, y: Number }],
  color: { type: String, default: '#000000' },
  fillColor: { type: String, default: 'transparent' },
  size: { type: Number, default: 2 },
  text: { type: String, default: '' },
  imageUrl: { type: String, default: '' },
  createdBy: { type: String, required: true },
  createdAt: { type: Date, default: Date.now },
  updatedAt: { type: Date, default: Date.now }
});

const BoardSchema = new mongoose.Schema({
  roomId: { type: String, required: true, unique: true, index: true },
  elements: [ElementSchema],
  version: { type: Number, default: 1 },
  metadata: { type: Object, default: {} }
});
```

---

## 🚀 Installation & Launch

Check the [INSTALLATION_AND_DEPLOYMENT.md](file:///c:/Users/hi/Desktop/whiteboard/INSTALLATION_AND_DEPLOYMENT.md) guide for running the application locally and deploying to production cloud services (Vercel & Render).
