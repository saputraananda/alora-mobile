import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';
import infoRoutes from './api/routes/info.routes.js';

// Resolve directory paths in ES module
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Load environment variables
dotenv.config();

const app = express();
const PORT = process.env.PORT || 5000;

// Middleware
app.use(cors());
app.use(express.json());

// API Routes
app.use('/api/info', infoRoutes);

// Serve static assets in production
if (process.env.NODE_ENV === 'production') {
  app.use(express.static(path.join(__dirname, 'dist')));

  // Wildcard handler for client side routing
  app.get('*', (req, res) => {
    res.sendFile(path.resolve(__dirname, 'dist', 'index.html'));
  });
} else {
  app.get('/', (req, res) => {
    res.send('React & Express Starter Pack API Server is running. Frontend dev server is active on port 5173.');
  });
}

// Start Server
app.listen(PORT, () => {
  console.log(`=========================================`);
  console.log(`  React & Express Monorepo Starter Server `);
  console.log(`  Status: Running                        `);
  console.log(`  Port:   http://localhost:${PORT}        `);
  console.log(`=========================================`);
});
