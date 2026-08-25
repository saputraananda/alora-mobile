import { Router } from 'express';
import { authenticate, requireEmployee } from '../middleware/auth.middleware.js';
import {
  fotoMasukUploadMiddleware,
  fotoKeluarUploadMiddleware,
  getTodayAttendance,
  getMonthAttendance,
  getAbsenLocation,
  serveAttendanceFile,
  checkInAttendance,
  checkOutAttendance,
  replaceCheckInPhoto,
  replaceCheckOutPhoto,
  deleteCheckInPhoto,
  deleteCheckOutPhoto,
} from '../controllers/attendance.controller.js';

const router = Router();

const handleUpload = (middleware) => (req, res, next) => {
  middleware(req, res, (err) => {
    if (err) {
      const message = err.code === 'LIMIT_FILE_SIZE'
        ? 'Ukuran foto absensi melebihi 5 MB'
        : err.message || 'Upload foto absensi gagal';
      return res.status(400).json({ message });
    }
    next();
  });
};

router.use(authenticate);
router.use(requireEmployee);

router.get('/today', getTodayAttendance);
router.get('/month', getMonthAttendance);
router.get('/location', getAbsenLocation);
router.get('/file/:filename', serveAttendanceFile);
router.put('/photo-in', handleUpload(fotoMasukUploadMiddleware), replaceCheckInPhoto);
router.put('/photo-out', handleUpload(fotoKeluarUploadMiddleware), replaceCheckOutPhoto);
router.delete('/photo-in', deleteCheckInPhoto);
router.delete('/photo-out', deleteCheckOutPhoto);
router.post('/check-in', handleUpload(fotoMasukUploadMiddleware), checkInAttendance);
router.post('/check-out', handleUpload(fotoKeluarUploadMiddleware), checkOutAttendance);

export default router;
