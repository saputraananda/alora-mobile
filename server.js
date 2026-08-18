import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';
import loginRoutes from './api/routes/auth/login.routes.js';
import profileRoutes from './api/routes/profile.routes.js';

// Resolve directory paths in ES module
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Load environment variables
dotenv.config();

const app = express();
const PORT = process.env.PORT || 1001;

// Middleware
app.use(cors());
app.use(express.json());

// API Routes
app.use('/api/auth', loginRoutes);
app.use('/api/profile', profileRoutes);
app.use('/api/employee', profileRoutes);

// Serve static assets in production
if (process.env.NODE_ENV === 'production') {
  app.use(express.static(path.join(__dirname, 'dist')));

  // Wildcard handler for client side routing
  app.get('*', (req, res) => {
    res.sendFile(path.resolve(__dirname, 'dist', 'index.html'));
  });
} else {
  app.get('/', (req, res) => {
    res.send('Alora Mobile API Server is running. Frontend dev server is active on port 1000.');
  });
}

// Start Server
app.listen(PORT, '0.0.0.0', () => {
  console.log(`=========================================`);
  console.log(`  Alora Mobile API Server Running         `);
  console.log(`  Status: Active                          `);
  console.log(`  Port:   http://0.0.0.0:${PORT}          `);
  console.log(`=========================================`);
});
