import type { Request, Response } from 'express';
import { asyncHandler } from '../middlewares/error.js';
import * as contractService from '../services/contract.service.js';
import { AppError } from '../utils/errors.js';
import {
  createContractSchema,
  updateContractSchema,
  contractQuerySchema,
  createVersionSchema,
  restoreVersionSchema,
  createCommentSchema,
  replyCommentSchema,
  createChatMessageSchema,
  saveDraftSchema,
} from '@cml/shared';
import * as collaborationService from '../services/collaboration.service.js';

function paramId(value: string | string[] | undefined): string {
  if (typeof value === 'string') return value;
  if (Array.isArray(value) && value[0]) return value[0];
  throw new AppError(400, 'BAD_REQUEST', 'Missing route parameter');
}

function getOrgId(req: Request): string {
  const orgId = req.membership?.organizationId?.toString();
  if (!orgId) {
    throw new AppError(400, 'NO_ORGANIZATION', 'Active organization required');
  }
  return orgId;
}

async function getContractOrgId(req: Request): Promise<string> {
  return contractService.resolveAccessibleOrganization(paramId(req.params.id), req.user!.id);
}

export const listContracts = asyncHandler(async (req: Request, res: Response) => {
  const orgId = getOrgId(req);
  const parsed = contractQuerySchema.parse(req.query);
  const result = await contractService.listContracts(orgId, parsed);
  res.json({ data: result });
});

export const getContract = asyncHandler(async (req: Request, res: Response) => {
  const orgId = await getContractOrgId(req);
  const contract = await contractService.getContract(paramId(req.params.id), orgId);
  res.json({ data: { contract } });
});

export const createContract = asyncHandler(async (req: Request, res: Response) => {
  const orgId = getOrgId(req);
  const parsed = createContractSchema.parse(req.body);
  const contract = await contractService.createContract(orgId, req.user!.id, parsed);
  res.status(201).json({ data: { contract } });
});

export const updateContract = asyncHandler(async (req: Request, res: Response) => {
  const orgId = await getContractOrgId(req);
  const parsed = updateContractSchema.parse(req.body);
  const contract = await contractService.updateContract(
    paramId(req.params.id),
    orgId,
    req.user!.id,
    parsed,
  );
  res.json({ data: { contract } });
});

export const deleteContract = asyncHandler(async (req: Request, res: Response) => {
  const orgId = await getContractOrgId(req);
  const result = await contractService.deleteContract(
    paramId(req.params.id),
    orgId,
    req.user!.id,
  );
  res.json({ data: result });
});

export const getDashboardSummary = asyncHandler(async (req: Request, res: Response) => {
  const orgId = getOrgId(req);
  const summary = await contractService.getDashboardSummary(orgId, req.user!.id);
  res.json({ data: summary });
});

export const listSharedWithMe = asyncHandler(async (_req: Request, res: Response) => {
  res.json({ data: { contracts: [] } });
});

export const listVersions = asyncHandler(async (req: Request, res: Response) => {
  const orgId = await getContractOrgId(req);
  const versions = await contractService.listVersions(paramId(req.params.id), orgId);
  res.json({ data: { versions } });
});

export const getVersion = asyncHandler(async (req: Request, res: Response) => {
  const orgId = await getContractOrgId(req);
  const version = await contractService.getVersion(
    paramId(req.params.id),
    paramId(req.params.versionId),
    orgId,
  );
  res.json({ data: { version } });
});

export const createVersion = asyncHandler(async (req: Request, res: Response) => {
  const orgId = await getContractOrgId(req);
  const parsed = createVersionSchema.parse(req.body);
  const version = await contractService.createVersion(
    paramId(req.params.id),
    orgId,
    req.user!.id,
    parsed,
  );
  res.status(201).json({ data: { version } });
});

export const restoreVersion = asyncHandler(async (req: Request, res: Response) => {
  const orgId = await getContractOrgId(req);
  const parsed = restoreVersionSchema.parse(req.body);
  const version = await contractService.restoreVersion(
    paramId(req.params.id),
    paramId(req.params.versionId),
    orgId,
    req.user!.id,
    parsed.changeDescription,
  );
  res.status(201).json({ data: { version } });
});

export const listComments = asyncHandler(async (req: Request, res: Response) => {
  const comments = await collaborationService.listComments(
    paramId(req.params.id),
    await getContractOrgId(req),
  );
  res.json({ data: { comments } });
});

export const createComment = asyncHandler(async (req: Request, res: Response) => {
  const parsed = createCommentSchema.parse(req.body);
  const comment = await collaborationService.createComment(
    paramId(req.params.id),
    await getContractOrgId(req),
    req.user!.id,
    parsed,
  );
  res.status(201).json({ data: { comment } });
});

export const replyToComment = asyncHandler(async (req: Request, res: Response) => {
  const parsed = replyCommentSchema.parse(req.body);
  const reply = await collaborationService.replyToComment(
    paramId(req.params.id),
    paramId(req.params.commentId),
    await getContractOrgId(req),
    req.user!.id,
    parsed,
  );
  res.status(201).json({ data: { reply } });
});

export const resolveComment = asyncHandler(async (req: Request, res: Response) => {
  const comment = await collaborationService.toggleCommentResolved(
    paramId(req.params.id),
    paramId(req.params.commentId),
    await getContractOrgId(req),
    req.user!.id,
  );
  res.json({ data: { comment } });
});

export const deleteComment = asyncHandler(async (req: Request, res: Response) => {
  const result = await collaborationService.deleteComment(
    paramId(req.params.id),
    paramId(req.params.commentId),
    await getContractOrgId(req),
    req.user!.id,
  );
  res.json({ data: result });
});

export const listChat = asyncHandler(async (req: Request, res: Response) => {
  const messages = await collaborationService.listChat(
    paramId(req.params.id),
    await getContractOrgId(req),
  );
  res.json({ data: { messages } });
});

export const createChatMessage = asyncHandler(async (req: Request, res: Response) => {
  const parsed = createChatMessageSchema.parse(req.body);
  const message = await collaborationService.createChatMessage(
    paramId(req.params.id),
    await getContractOrgId(req),
    req.user!.id,
    parsed,
  );
  res.status(201).json({ data: { message } });
});

export const getDraft = asyncHandler(async (req: Request, res: Response) => {
  const result = await collaborationService.getDraft(
    paramId(req.params.id),
    await getContractOrgId(req),
  );
  res.json({ data: result });
});

export const saveDraft = asyncHandler(async (req: Request, res: Response) => {
  const parsed = saveDraftSchema.parse(req.body);
  const result = await collaborationService.saveDraft(
    paramId(req.params.id),
    await getContractOrgId(req),
    parsed.editorContent,
  );
  res.json({ data: result });
});
