import type { Request, Response } from 'express';
import { asyncHandler } from '../middlewares/error.js';
import * as organizationService from '../services/organization.service.js';
import { AppError } from '../utils/errors.js';

function paramId(value: string | string[] | undefined): string {
  if (typeof value === 'string') return value;
  if (Array.isArray(value) && value[0]) return value[0];
  throw new AppError(400, 'BAD_REQUEST', 'Missing route parameter');
}

export const getOrganization = asyncHandler(async (req: Request, res: Response) => {
  const organization = await organizationService.getOrganization(paramId(req.params.id));
  res.json({ data: { organization } });
});

export const updateOrganization = asyncHandler(async (req: Request, res: Response) => {
  const organization = await organizationService.updateOrganization(
    paramId(req.params.id),
    req.body.name,
    req.user!.id,
  );
  res.json({ data: { organization } });
});

export const listMembers = asyncHandler(async (req: Request, res: Response) => {
  const members = await organizationService.listMembers(paramId(req.params.id));
  res.json({ data: { members } });
});

export const inviteMember = asyncHandler(async (req: Request, res: Response) => {
  const invitation = await organizationService.inviteMember(
    paramId(req.params.id),
    req.user!.id,
    req.body,
  );
  res.status(201).json({ data: { invitation } });
});

export const updateMember = asyncHandler(async (req: Request, res: Response) => {
  const membership = await organizationService.updateMemberRole(
    paramId(req.params.id),
    paramId(req.params.memberId),
    req.body.role,
    req.user!.id,
    req.membership!.id,
  );
  res.json({ data: { membership } });
});

export const removeMember = asyncHandler(async (req: Request, res: Response) => {
  await organizationService.removeMember(
    paramId(req.params.id),
    paramId(req.params.memberId),
    req.user!.id,
    req.membership!.id,
  );
  res.json({ data: { ok: true } });
});

export const previewInvitation = asyncHandler(async (req: Request, res: Response) => {
  const token = String(req.query.token ?? '');
  if (!token) {
    throw new AppError(400, 'VALIDATION_ERROR', 'Token is required');
  }
  const invitation = await organizationService.getInvitationPreview(token);
  res.json({ data: { invitation } });
});

export const listPendingInvitations = asyncHandler(async (req: Request, res: Response) => {
  const invitations = await organizationService.listPendingInvitations(paramId(req.params.id));
  res.json({ data: { invitations } });
});

export const acceptInvitation = asyncHandler(async (req: Request, res: Response) => {
  const result = await organizationService.acceptInvitation(req.user!.id, req.body);
  res.json({ data: result });
});
