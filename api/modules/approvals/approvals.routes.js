import { Router } from 'express';
import { authenticate, requireEmployee } from '../../shared/middleware/auth.middleware.js';
import { getCapability, getSummary, getInbox } from './approvals.controller.js';

const router = Router();

router.use(authenticate);
router.use(requireEmployee);

router.get('/capability', getCapability);
router.get('/summary', getSummary);
router.get('/inbox', getInbox);

export default router;
