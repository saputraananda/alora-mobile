import { Router } from 'express';
import { authenticate, requireEmployee } from '../../shared/middleware/auth.middleware.js';
import { getTeamSummary } from './team.controller.js';

const router = Router();

router.use(authenticate);
router.use(requireEmployee);

router.get('/summary', getTeamSummary);

export default router;
