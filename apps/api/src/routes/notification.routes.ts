import { Router } from 'express';
import { asyncHandler } from '../middlewares/error.js';
import { requireAuth } from '../middlewares/auth.js';
import * as collaborationService from '../services/collaboration.service.js';

export const notificationRouter = Router();

notificationRouter.use(requireAuth);

notificationRouter.get(
  '/',
  asyncHandler(async (req, res) => {
    const notifications = await collaborationService.listNotifications(req.user!.id);
    res.json({ data: { notifications } });
  }),
);

notificationRouter.post(
  '/mark-all-read',
  asyncHandler(async (req, res) => {
    const result = await collaborationService.markAllNotificationsRead(req.user!.id);
    res.json({ data: result });
  }),
);

notificationRouter.patch(
  '/:id/read',
  asyncHandler(async (req, res) => {
    const result = await collaborationService.markNotificationRead(
      String(req.params.id),
      req.user!.id,
    );
    res.json({ data: result });
  }),
);
