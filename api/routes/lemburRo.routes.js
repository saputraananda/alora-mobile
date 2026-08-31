import { Router } from 'express';
import { authenticate, requireEmployee } from '../middleware/auth.middleware.js';
import {
  listRequests,
  getStats,
  createRequest,
  updateRequest,
  cancelRequest,
} from '../controllers/lemburRo.controller.js';

const router = Router();

router.use(authenticate);
router.use(requireEmployee);

router.get('/list', listRequests);
router.get('/stats', getStats);
router.post('/', createRequest);
router.put('/:id', updateRequest);
router.delete('/:id', cancelRequest);

export default router;
