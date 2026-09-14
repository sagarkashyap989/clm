import type { Request, Response } from 'express';
import * as authService from '../services/auth.service.js';
import { clearAuthCookies, REFRESH_COOKIE, setAuthCookies } from '../utils/cookies.js';
import { AppError } from '../utils/errors.js';
import { asyncHandler } from '../middlewares/error.js';

export const register = asyncHandler(async (req: Request, res: Response) => {
  const result = await authService.register(req.body);
  setAuthCookies(res, result.accessToken, result.refreshToken);
  res.status(201).json({
    data: {
      user: result.user,
      organization: result.organization,
      role: result.role,
    },
  });
});

export const login = asyncHandler(async (req: Request, res: Response) => {
  const result = await authService.login(req.body);
  setAuthCookies(res, result.accessToken, result.refreshToken);
  res.json({
    data: {
      user: result.user,
      organization: result.organization,
      role: result.role,
    },
  });
});

export const logout = asyncHandler(async (req: Request, res: Response) => {
  if (req.user) {
    await authService.logout(req.user.id);
  }
  clearAuthCookies(res);
  res.json({ data: { ok: true } });
});

export const refresh = asyncHandler(async (req: Request, res: Response) => {
  const token = req.cookies?.[REFRESH_COOKIE] as string | undefined;
  if (!token) {
    throw new AppError(401, 'UNAUTHORIZED', 'Refresh token required');
  }
  const tokens = await authService.refresh(token);
  setAuthCookies(res, tokens.accessToken, tokens.refreshToken);
  res.json({ data: { ok: true } });
});

export const me = asyncHandler(async (req: Request, res: Response) => {
  const data = await authService.getMe(req.user!.id);
  res.json({ data });
});

export const verifyEmail = asyncHandler(async (req: Request, res: Response) => {
  const token = String(req.body.token ?? req.query.token ?? '');
  if (!token) {
    throw new AppError(400, 'VALIDATION_ERROR', 'Token is required');
  }
  const user = await authService.verifyEmail(token);
  res.json({ data: { user } });
});

export const forgotPassword = asyncHandler(async (req: Request, res: Response) => {
  await authService.forgotPassword(req.body.email);
  res.json({ data: { ok: true } });
});

export const resetPassword = asyncHandler(async (req: Request, res: Response) => {
  await authService.resetPassword(req.body.token, req.body.password);
  res.json({ data: { ok: true } });
});

export const updateProfile = asyncHandler(async (req: Request, res: Response) => {
  const user = await authService.updateProfile(req.user!.id, req.body.name);
  res.json({ data: { user } });
});

export const changePassword = asyncHandler(async (req: Request, res: Response) => {
  await authService.changePassword(
    req.user!.id,
    req.body.currentPassword,
    req.body.newPassword,
  );
  clearAuthCookies(res);
  res.json({ data: { ok: true } });
});
