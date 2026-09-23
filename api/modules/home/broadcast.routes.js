import { Router } from 'express';
import { authenticate } from '../../shared/middleware/auth.middleware.js';
import { listActiveBroadcasts } from './broadcast.controller.js';

const router = Router();

router.use(authenticate);

router.get('/', listActiveBroadcasts);

export default router;
