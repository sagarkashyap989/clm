import { Router } from 'express';
import * as contractController from '../controllers/contract.controller.js';
import { requireAuth } from '../middlewares/auth.js';

export const contractRouter = Router();

contractRouter.use(requireAuth);

contractRouter.get('/dashboard-summary', contractController.getDashboardSummary);
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

