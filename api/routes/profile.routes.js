import express from 'express';
import { 
  getProfileDetail, 
  updateProfile, 
  getBanks, 
  getEducationLevels, 
  uploadDoc 
} from '../controllers/profile.controller.js';

const router = express.Router();

router.get('/detail', getProfileDetail);
router.get('/profile-detail', getProfileDetail);
router.put('/update-profile', updateProfile);
router.get('/banks', getBanks);
router.get('/education-levels', getEducationLevels);
router.post('/upload-doc/:docKey', uploadDoc);

export default router;
