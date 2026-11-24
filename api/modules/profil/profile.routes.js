import express from 'express';
import {
  getProfileDetail, 
  updateProfile, 
  getBanks, 
  getEducationLevels, 
  uploadDoc,
  getPin,
  setPin
} from './profile.controller.js';
import { authenticate, requireEmployee } from '../../shared/middleware/auth.middleware.js';

const router = express.Router();

router.get('/detail', getProfileDetail);
router.get('/profile-detail', getProfileDetail);
router.put('/update-profile', updateProfile);
router.get('/banks', getBanks);
router.get('/education-levels', getEducationLevels);
router.post('/upload-doc/:docKey', uploadDoc);
router.get('/pin', authenticate, requireEmployee, getPin);
router.put('/pin', authenticate, requireEmployee, setPin);

export default router;
