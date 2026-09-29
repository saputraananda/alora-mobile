import { Router } from 'express';
import { authenticate, requireEmployee } from '../../shared/middleware/auth.middleware.js';
import { downloadMyPayslip, listMyPayslips } from './payslip.controller.js';

const router = Router();

router.use(authenticate, requireEmployee);

router.get('/', listMyPayslips);
router.get('/:id/download', downloadMyPayslip);

export default router;
