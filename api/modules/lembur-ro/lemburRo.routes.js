import { Router } from 'express';
import { authenticate, requireEmployee } from '../../shared/middleware/auth.middleware.js';
import {
  listRequests,
  getStats,
  createRequest,
  updateRequest,
  cancelRequest,
  listPendingApprovals,
  approveSupervisor,
  rejectSupervisor,
  approveHRD,
  rejectHRD,
} from './lemburRo.controller.js';

const router = Router();

router.use(authenticate);
router.use(requireEmployee);

router.get('/list', listRequests);
router.get('/stats', getStats);
router.get('/pending-approvals', listPendingApprovals);
router.post('/:id/supervisor-approve', approveSupervisor);
router.post('/:id/supervisor-reject', rejectSupervisor);
router.post('/:id/hrd-approve', approveHRD);
router.post('/:id/hrd-reject', rejectHRD);
router.post('/', createRequest);
router.put('/:id', updateRequest);
router.delete('/:id', cancelRequest);

export default router;
