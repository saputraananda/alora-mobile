import { Router } from 'express';
import { authenticate } from '../middleware/auth.middleware.js';
import { listActiveBroadcasts } from '../controllers/broadcast.controller.js';

const router = Router();

router.use(authenticate);

router.get('/', listActiveBroadcasts);

export default router;
