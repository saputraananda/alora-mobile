import { Router } from 'express';
import { authenticate, requireEmployee } from '../middleware/auth.middleware.js';
import {
  sessionFotoMasukMiddleware,
  sessionFotoKeluarMiddleware,
  listSessions,
  getActiveSession,
  lemburCheckIn,
  lemburCheckOut,
  earnedRoCheckIn,
  earnedRoCheckOut,
  serveSessionFile,
} from '../controllers/attendanceSession.controller.js';

const router = Router();

const handleUpload = (middleware) => (req, res, next) => {
  middleware(req, res, (err) => {
    if (err) {
      const message = err.code === 'LIMIT_FILE_SIZE'
        ? 'Ukuran foto melebihi 5 MB'
        : err.message || 'Upload foto gagal';
      return res.status(400).json({ message });
    }
    next();
  });
};

router.get('/file/:filename', serveSessionFile);

router.use(authenticate);
router.use(requireEmployee);

router.get('/list', listSessions);
router.get('/active', getActiveSession);
router.post('/lembur/check-in', handleUpload(sessionFotoMasukMiddleware), lemburCheckIn);
router.post('/lembur/check-out', handleUpload(sessionFotoKeluarMiddleware), lemburCheckOut);
router.post('/earned-ro/check-in', handleUpload(sessionFotoMasukMiddleware), earnedRoCheckIn);
router.post('/earned-ro/check-out', handleUpload(sessionFotoKeluarMiddleware), earnedRoCheckOut);

export default router;
