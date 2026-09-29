import { Router } from 'express';
import { authenticate, requireEmployee } from '../../shared/middleware/auth.middleware.js';
import { requireAloraMobileSecret } from '../../shared/middleware/fileAccess.middleware.js';
import { downloadMyPayslip, listMyPayslips } from './payslip.controller.js';
import {
  deletePayslipFile,
  payslipFileUpload,
  servePayslipFile,
  storePayslipFile,
} from './payslipFile.controller.js';

const router = Router();

const handlePayslipFileUpload = (req, res, next) =>
  payslipFileUpload.single('file')(req, res, (err) =>
    err ? res.status(400).json({ message: err.message }) : next()
  );

router.post('/files', requireAloraMobileSecret, handlePayslipFileUpload, storePayslipFile);
router.get('/files/:fileName', requireAloraMobileSecret, servePayslipFile);
router.delete('/files/:fileName', requireAloraMobileSecret, deletePayslipFile);

router.use(authenticate, requireEmployee);

router.get('/', listMyPayslips);
router.get('/:id/download', downloadMyPayslip);

export default router;
