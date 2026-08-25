import { Router } from 'express';
import { authenticate, requireEmployee, requireManagement } from '../middleware/auth.middleware.js';
import {
  selfieUploadMiddleware,
  getManagementToday,
  punchManagementSelfie,
  deleteManagementPunch,
} from '../controllers/managementAttendance.controller.js';

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

router.use(authenticate, requireEmployee, requireManagement);

router.get('/today', getManagementToday);
router.post('/punch-selfie', handleUpload(selfieUploadMiddleware), punchManagementSelfie);
router.post('/delete-punch', deleteManagementPunch);

export default router;
