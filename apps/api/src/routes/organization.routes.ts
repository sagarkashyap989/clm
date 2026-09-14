import {
  inviteMemberSchema,
  OrgRole,
  updateMemberSchema,
  updateOrganizationSchema,
} from '@cml/shared';
import { Router } from 'express';
import * as organizationController from '../controllers/organization.controller.js';
import { requireAuth, requireOrgMember, requireRole } from '../middlewares/auth.js';
import { validateBody } from '../middlewares/error.js';

export const organizationRouter = Router();

organizationRouter.get(
  '/invitations/preview',
  organizationController.previewInvitation,
);

organizationRouter.use(requireAuth);

organizationRouter.get(
  '/:id',
  requireOrgMember,
  organizationController.getOrganization,
);

organizationRouter.patch(
  '/:id',
  requireOrgMember,
  requireRole(OrgRole.ADMIN),
  validateBody(updateOrganizationSchema),
  organizationController.updateOrganization,
);

organizationRouter.get(
  '/:id/members',
  requireOrgMember,
  organizationController.listMembers,
);

organizationRouter.post(
  '/:id/members/invite',
  requireOrgMember,
  requireRole(OrgRole.ADMIN),
  validateBody(inviteMemberSchema),
  organizationController.inviteMember,
);

organizationRouter.patch(
  '/:id/members/:memberId',
  requireOrgMember,
  requireRole(OrgRole.ADMIN),
  validateBody(updateMemberSchema),
  organizationController.updateMember,
);

organizationRouter.delete(
  '/:id/members/:memberId',
  requireOrgMember,
  requireRole(OrgRole.ADMIN),
  organizationController.removeMember,
);
