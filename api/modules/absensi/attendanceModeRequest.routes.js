import { Router } from 'express';
import { authenticate, requireEmployee } from '../../shared/middleware/auth.middleware.js';
import {
  approveRequest,
  cancelRequest,
  createRequest,
  getApproverCapability,
  listMine,
  listPendingApprovals,
  rejectRequest,
} from './attendanceModeRequest.controller.js';

const router = Router();

router.use(authenticate);
router.use(requireEmployee);

router.get('/capability', getApproverCapability);
router.get('/mine', listMine);
router.get('/pending-approvals', listPendingApprovals);
router.post('/', createRequest);
router.delete('/:id', cancelRequest);
router.post('/:id/approve', approveRequest);
router.post('/:id/reject', rejectRequest);

export default router;
