import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import loginRoutes from './modules/auth/login.routes.js';
import profileRoutes from './modules/profil/profile.routes.js';
import leaveRoutes from './modules/perizinan/leave.routes.js';
import attendanceRoutes from './modules/absensi/attendance.routes.js';
import managementAttendanceRoutes from './modules/management-absensi/managementAttendance.routes.js';
import bugarRoutes from './modules/bugar/bugar.routes.js';
import broadcastRoutes from './modules/home/broadcast.routes.js';
import lemburRoRoutes from './modules/lembur-ro/lemburRo.routes.js';
import attendanceSessionRoutes from './modules/absensi/attendanceSession.routes.js';
import attendanceModeRequestRoutes from './modules/absensi/attendanceModeRequest.routes.js';
import approvalsRoutes from './modules/approvals/approvals.routes.js';
import payslipRoutes from './modules/slip-gaji/payslip.routes.js';
import teamRoutes from './modules/team/team.routes.js';

dotenv.config();

const app = express();

app.set('etag', false);

app.use(cors());
app.use(express.json());

// Prevent browser/CDN from caching API responses (avoids HTTP 304 empty body issues)
app.use('/api', (req, res, next) => {
  res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
  res.setHeader('Pragma', 'no-cache');
  res.setHeader('Expires', '0');
  next();
});

// Mounted routes (public URL paths unchanged)
app.use('/api/auth', loginRoutes);
app.use('/api/profile', profileRoutes);
app.use('/api/employee', profileRoutes);
app.use('/api/leave', leaveRoutes);
app.use('/api/attendance', attendanceRoutes);
app.use('/api/management-attendance', managementAttendanceRoutes);
app.use('/api/bugar', bugarRoutes);
app.use('/api/broadcast', broadcastRoutes);
app.use('/api/lembur-ro', lemburRoRoutes);
app.use('/api/attendance-sessions', attendanceSessionRoutes);
app.use('/api/attendance-mode-requests', attendanceModeRequestRoutes);
app.use('/api/approvals', approvalsRoutes);
app.use('/api/payslips', payslipRoutes);
app.use('/api/team', teamRoutes);

// Health check endpoint
app.get('/api', (req, res) => {
  res.json({ success: true, message: 'Alora Mobile API is operational.' });
});

export default app;
