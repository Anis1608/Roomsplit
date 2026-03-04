import express from 'express';
import dotenv from 'dotenv';
import cors from 'cors';
import { createServer } from 'http';
import https from 'https';
import path from 'path';
import { fileURLToPath } from 'url';
import { Server } from 'socket.io';
import connectDB from './config/db.js';
import authRoutes from './routes/auth.routes.js';
import groupRoutes from './routes/group.routes.js';
import expenseRoutes from './routes/expense.routes.js';

dotenv.config();

connectDB();

const app = express();
const httpServer = createServer(app);

const allowedOrigins = JSON.parse(process.env.ORIGINS || '[]');

export const io = new Server(httpServer, {
  path: '/roomsplit-be/socket.io',
  cors: {
    origin: allowedOrigins,
    methods: ['GET', 'POST', 'PUT', 'DELETE'],
    credentials: true,
  },
});

app.use(cors({
  origin: allowedOrigins,
  credentials: true,
}));
app.use(express.json());

// Routes
app.use('/api/auth', authRoutes);
app.use('/api/groups', groupRoutes);
app.use('/api/expenses', expenseRoutes);

// Stay Awake Ping Route
app.get('/api/ping', (req, res) => {
  res.status(200).json({ status: 'Server is awake!' });
});

// Serve frontend static files
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const frontendDistPath = path.join(__dirname, '..', 'frontend', 'dist');
app.use(express.static(frontendDistPath));

// All non-API routes serve the React app
app.get(/^\/(?!api).*/, (req, res) => {
  res.sendFile(path.join(frontendDistPath, 'index.html'));
});

// Socket.io for Real-time updates
io.on('connection', (socket) => {
  console.log('A user connected:', socket.id);
  
  socket.on('join_group', (groupId) => {
    socket.join(groupId);
    console.log(`User joined group: ${groupId}`);
  });

  socket.on('disconnect', () => {
    console.log('User disconnected:', socket.id);
  });
});

const PORT = process.env.PORT || 5000;
httpServer.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
  
  // Set up self-ping to keep the server awake on Render (Every 11 minutes)
  const PING_INTERVAL = 11 * 60 * 1000; 
  setInterval(() => {
    const backendUrl = process.env.RENDER_EXTERNAL_URL;
    if (backendUrl) {
      https.get(`${backendUrl}/api/ping`, (res) => {
        console.log(`[Self-Ping] Status: ${res.statusCode} - Keeping server awake!`);
      }).on('error', (err) => {
        console.error(`[Self-Ping Focus] Error: ${err.message}`);
      });
    }
  }, PING_INTERVAL);
});
