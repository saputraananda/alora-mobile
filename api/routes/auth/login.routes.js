import { Router } from 'express';

import { handleLogin } from '../../controllers/auth/login.controller.js';

import { getLeaderRole } from '../../controllers/auth/leaderRole.controller.js';

import {

  getWebauthnStatus,

  registerOptions,

  registerVerify,

  removeCredentials,

  loginOptions,

  loginVerify,

  hasCredential,

} from '../../controllers/auth/webauthn.controller.js';

import { authenticate } from '../../middleware/auth.middleware.js';

import {
  getFaceStatus,
  enrollFace,
  removeFace,
  faceLogin,
  hasFaceEnrollment,
} from '../../controllers/auth/face.controller.js';



const router = Router();



router.post('/login', handleLogin);



router.get('/face/status', authenticate, getFaceStatus);
router.post('/face/enroll', authenticate, enrollFace);
router.delete('/face/remove', authenticate, removeFace);
router.post('/face/login', faceLogin);
router.get('/face/has-enrollment', hasFaceEnrollment);



router.get('/webauthn/status', authenticate, getWebauthnStatus);

router.post('/webauthn/register-options', authenticate, registerOptions);

router.post('/webauthn/register-verify', authenticate, registerVerify);

router.delete('/webauthn/remove', authenticate, removeCredentials);

router.post('/webauthn/login-options', loginOptions);

router.post('/webauthn/login-verify', loginVerify);

router.get('/webauthn/has-credential', hasCredential);



router.get('/leader-role', authenticate, getLeaderRole);



export default router;

