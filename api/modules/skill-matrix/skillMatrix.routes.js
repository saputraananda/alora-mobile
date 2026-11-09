import { Router } from 'express';
import { authenticate, requireEmployee } from '../../shared/middleware/auth.middleware.js';
import { getAccess, getPositions, getEmployees, getLatestAssessment, saveAssessment } from './skillMatrix.controller.js';

const router = Router();

router.use(authenticate);
router.use(requireEmployee);

router.get('/access', getAccess);
router.get('/positions', getPositions);
router.get('/employees', getEmployees);
router.get('/assessments/latest', getLatestAssessment);
router.post('/assessments', saveAssessment);

export default router;
