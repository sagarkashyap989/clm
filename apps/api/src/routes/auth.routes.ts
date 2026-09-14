import {
  changePasswordSchema,
  forgotPasswordSchema,
  loginSchema,
  registerSchema,
  resetPasswordSchema,
  updateProfileSchema,
} from '@cml/shared';
import { Router } from 'express';
import rateLimit from 'express-rate-limit';
import * as authController from '../controllers/auth.controller.js';
import { requireAuth } from '../middlewares/auth.js';
import { validateBody } from '../middlewares/error.js';

const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 100,
  standardHeaders: true,
  legacyHeaders: false,
});

export const authRouter = Router();

authRouter.use(authLimiter);

authRouter.post('/register', validateBody(registerSchema), authController.register);
authRouter.post('/login', validateBody(loginSchema), authController.login);
authRouter.post('/logout', requireAuth, authController.logout);
authRouter.post('/refresh', authController.refresh);
authRouter.get('/me', requireAuth, authController.me);
authRouter.post('/verify-email', authController.verifyEmail);
authRouter.post('/forgot-password', validateBody(forgotPasswordSchema), authController.forgotPassword);
authRouter.post('/reset-password', validateBody(resetPasswordSchema), authController.resetPassword);
authRouter.patch('/profile', requireAuth, validateBody(updateProfileSchema), authController.updateProfile);
authRouter.post(
  '/change-password',
  requireAuth,
  validateBody(changePasswordSchema),
  authController.changePassword,
);
