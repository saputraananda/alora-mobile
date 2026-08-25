import { Router } from 'express';
import { authenticate, requireEmployee } from '../middleware/auth.middleware.js';
import {
  doctorNoteUploadMiddleware,
  getTodayLeave,
  getLeaveList,
  getLeaveYears,
  getLeaveStats,
  submitLeave,
  updateLeave,
  cancelLeave,
  serveDoctorNote,
} from '../controllers/leave.controller.js';

const router = Router();

const handleUpload = (req, res, next) => {
  doctorNoteUploadMiddleware(req, res, (err) => {
    if (err) {
      const message = err.code === 'LIMIT_FILE_SIZE'
        ? 'Ukuran foto surat dokter melebihi 5 MB'
        : err.message || 'Upload surat dokter gagal';
      return res.status(400).json({ message });
    }
    next();
  });
};

router.get('/doctor-notes/:filename', authenticate, requireEmployee, serveDoctorNote);

router.use(authenticate);
router.use(requireEmployee);

router.get('/today', getTodayLeave);
router.get('/years', getLeaveYears);
router.get('/stats', getLeaveStats);
router.get('/list', getLeaveList);
router.post('/', handleUpload, submitLeave);
router.put('/:id', handleUpload, updateLeave);
router.delete('/:id', cancelLeave);

export default router;
