import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import loginRoutes from './routes/auth/login.routes.js';
import profileRoutes from './routes/profile.routes.js';
import leaveRoutes from './routes/leave.routes.js';
import attendanceRoutes from './routes/attendance.routes.js';
import managementAttendanceRoutes from './routes/managementAttendance.routes.js';
import bugarRoutes from './routes/bugar.routes.js';

dotenv.config();

const app = express();

app.use(cors());
app.use(express.json());

// Mounted routes
app.use('/api/auth', loginRoutes);
app.use('/api/profile', profileRoutes);
app.use('/api/employee', profileRoutes);
app.use('/api/leave', leaveRoutes);
app.use('/api/attendance', attendanceRoutes);
app.use('/api/management-attendance', managementAttendanceRoutes);
app.use('/api/bugar', bugarRoutes);

// Health check endpoint
app.get('/api', (req, res) => {
  res.json({ success: true, message: 'Alora Mobile API is operational.' });
});

export default app;
