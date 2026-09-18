import 'dotenv/config';
import http from 'node:http';
import express from 'express';
import path from 'path';
import { fileURLToPath } from 'url';
import { Server as SocketServer } from 'socket.io';
import app from './api/index.js';
import { getAppBuildId } from './api/utils/appBuildVersion.js';

// Resolve directory paths in ES module
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const PORT = process.env.PORT || 1001;
const httpServer = http.createServer(app);
const buildId = getAppBuildId();

const io = new SocketServer(httpServer, {
  path: '/socket.io',
  cors: {
    origin: process.env.CORS_ORIGIN || true,
    credentials: true,
  },
});

io.on('connection', (socket) => {
  socket.emit('app:version', { buildId });
});

// Serve static assets in standalone production Node server
if (process.env.NODE_ENV === 'production') {
  app.use(express.static(path.join(__dirname, 'dist')));

  // Wildcard handler for client side routing
  app.get('*', (req, res) => {
    res.sendFile(path.resolve(__dirname, 'dist', 'index.html'));
  });
}

// Start Local Server
httpServer.listen(PORT, '0.0.0.0', () => {
  console.log(`=========================================`);
  console.log(`  Alora Mobile API Server Running         `);
  console.log(`  Status: Active                          `);
  console.log(`  Port:   http://0.0.0.0:${PORT}          `);
  console.log(`  Build ID: ${buildId}`);
  console.log(`=========================================`);
});

export default app;
