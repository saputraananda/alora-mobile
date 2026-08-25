import { Router } from 'express';
import { authenticate, requireEmployee } from '../middleware/auth.middleware.js';
import {
  getBugarProfile,
  putBugarProfile,
  startBugarHaid,
  respondBugarHaidFollowUp,
  stopBugarHaid,
  listBugarSessions,
  createBugarSession,
  getBugarStats,
  getBugarLeaderboard,
} from '../controllers/bugar.controller.js';

const router = Router();

router.use(authenticate);
router.use(requireEmployee);

router.get('/profile', getBugarProfile);
router.put('/profile', putBugarProfile);
router.put('/profile/haid/start', startBugarHaid);
router.put('/profile/haid/follow-up', respondBugarHaidFollowUp);
router.put('/profile/haid/stop', stopBugarHaid);
router.get('/sessions', listBugarSessions);
router.post('/sessions', createBugarSession);
router.get('/stats', getBugarStats);
router.get('/leaderboard', getBugarLeaderboard);

export default router;
