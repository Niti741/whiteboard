# Installation & Deployment Guide

This guide details instructions for launching CoDraw locally and deploying both the frontend and backend servers to production cloud platforms.

---

## 🛠️ Local Installation

### Prerequisites
- **Node.js** (v18.x or higher)
- **npm** (v9.x or higher)
- **MongoDB** (Optional. If not running, CoDraw automatically falls back to in-memory mocks so you can test it immediately).

---

### Step 1: Set Up and Run the Backend Server

1. Open your terminal and navigate to the backend directory:
   ```bash
   cd backend
   ```

2. Install dependencies:
   ```bash
   npm install
   ```

3. Create your local environment configuration file:
   - Copy `.env.example` to a new file named `.env`:
     ```bash
     cp .env.example .env
     ```
   - (Windows Command Prompt: `copy .env.example .env`)
   - (Windows PowerShell: `Copy-Item .env.example .env`)

4. Configure `.env` variables:
   - `PORT`: Set the port you want the server to listen on (Default: `5000`).
   - `CLIENT_URL`: Set the URL of your frontend application to allow CORS request approvals (Default: `http://localhost:5173`).
   - `MONGODB_URI`: Set your MongoDB connection string (e.g., `mongodb://localhost:27017/codraw`). *Leave blank or omit to run in-memory fallback mode.*

5. Launch the backend server:
   - For development (with hot-reloads):
     ```bash
     npm run dev
     ```
   - For production launch:
     ```bash
     npm start
     ```
   - The server will output: `Server is running on port 5000`.

---

### Step 2: Set Up and Run the Frontend Client

1. Open a new terminal and navigate to the frontend directory:
   ```bash
   cd frontend
   ```

2. Install dependencies:
   ```bash
   npm install
   ```

3. Create your frontend environment configuration:
   - Create a file named `.env` in the root of the `frontend/` directory.
   - Add the following variable pointing to your backend address:
     ```text
     VITE_BACKEND_URL=http://localhost:5000
     ```

4. Launch the Vite development server:
   ```bash
   npm run dev
   ```
   - Open your browser to the local URL displayed: `http://localhost:5173`.

---

### Step 3: Test Real-Time Collaboration Locally

1. Open `http://localhost:5173` in a web browser.
2. Enter your name and click **Create New Room**.
3. Copy the URL from the address bar (it will contain `?room=xxxx-xxxx`) or copy the room ID using the copy button on the topbar.
4. Open an **Incognito/Private window** or another browser side-by-side.
5. Paste the link or enter the Room ID and a different name, then click **Join Room**.
6. Draw on either canvas and watch the lines and cursors synchronize instantly!

---

## 🚀 Production Deployment

### 1. Backend Server Deployment (Render)

Render is ideal for deploying Node.js Socket.IO servers because it supports permanent WebSockets connection upgrades.

1. Create a free account on [Render](https://render.com).
2. Click **New +** and select **Web Service**.
3. Connect your GitHub repository containing the codebase.
4. Set the following Web Service properties:
   - **Name**: `codraw-backend`
   - **Environment**: `Node`
   - **Root Directory**: `backend`
   - **Build Command**: `npm install`
   - **Start Command**: `node server.js`
5. Under **Environment Variables**, add:
   - `PORT`: `5000` (Render will override this, but standard default)
   - `MONGODB_URI`: Your production MongoDB URI (e.g., MongoDB Atlas link)
   - `CLIENT_URL`: The URL of your Vercel frontend app (e.g., `https://codraw.vercel.app`)
6. Deploy the Web Service. Render will provide a public URL like `https://codraw-backend.onrender.com`.

---

### 2. Frontend Client Deployment (Vercel)

Vercel provides high-performance static hosting for React/Vite builds.

1. Create a free account on [Vercel](https://vercel.com).
2. Click **Add New** -> **Project**.
3. Import your GitHub repository.
4. Configure the project properties:
   - **Framework Preset**: `Vite`
   - **Root Directory**: `frontend`
   - **Build Command**: `npm run build`
   - **Output Directory**: `dist`
5. Under **Environment Variables**, add:
   - `VITE_BACKEND_URL`: The URL of your backend deployed on Render (e.g., `https://codraw-backend.onrender.com`).
6. Click **Deploy**. Vercel compiles the Tailwind CSS v4 assets and serves your application on a Vercel subdomain.
