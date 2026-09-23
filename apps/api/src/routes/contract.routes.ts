import { Router } from 'express';
import * as contractController from '../controllers/contract.controller.js';
import { requireActiveOrganization, requireAuth } from '../middlewares/auth.js';

export const contractRouter = Router();

contractRouter.use(requireAuth, requireActiveOrganization);

contractRouter.get('/dashboard-summary', contractController.getDashboardSummary);
contractRouter.get('/shared-with-me', contractController.listSharedWithMe);
contractRouter.get('/', contractController.listContracts);
contractRouter.post('/', contractController.createContract);
contractRouter.get('/:id', contractController.getContract);
contractRouter.patch('/:id', contractController.updateContract);
contractRouter.delete('/:id', contractController.deleteContract);

// Version history routes (Phase 3)
contractRouter.get('/:id/versions', contractController.listVersions);
contractRouter.get('/:id/versions/:versionId', contractController.getVersion);
contractRouter.post('/:id/versions', contractController.createVersion);
contractRouter.post('/:id/versions/:versionId/restore', contractController.restoreVersion);

contractRouter.get('/:id/comments', contractController.listComments);
contractRouter.post('/:id/comments', contractController.createComment);
contractRouter.post('/:id/comments/:commentId/reply', contractController.replyToComment);
contractRouter.patch('/:id/comments/:commentId/resolve', contractController.resolveComment);
contractRouter.delete('/:id/comments/:commentId', contractController.deleteComment);

contractRouter.get('/:id/chat', contractController.listChat);
contractRouter.post('/:id/chat', contractController.createChatMessage);

contractRouter.get('/:id/draft', contractController.getDraft);
contractRouter.patch('/:id/draft', contractController.saveDraft);

