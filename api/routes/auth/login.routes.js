import { Router } from 'express';
import { handleLogin } from '../../controllers/auth/login.controller.js';

const router = Router();

// POST /api/auth/login
router.post('/login', handleLogin);

export default router;
