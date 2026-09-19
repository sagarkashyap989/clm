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
} from '@cml/shared';

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

export const listContracts = asyncHandler(async (req: Request, res: Response) => {
  const orgId = getOrgId(req);
  const parsed = contractQuerySchema.parse(req.query);
  const result = await contractService.listContracts(orgId, parsed);
  res.json({ data: result });
});

export const getContract = asyncHandler(async (req: Request, res: Response) => {
  const orgId = getOrgId(req);
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
  const orgId = getOrgId(req);
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
  const orgId = getOrgId(req);
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

export const listVersions = asyncHandler(async (req: Request, res: Response) => {
  const orgId = getOrgId(req);
  const versions = await contractService.listVersions(paramId(req.params.id), orgId);
  res.json({ data: { versions } });
});

export const getVersion = asyncHandler(async (req: Request, res: Response) => {
  const orgId = getOrgId(req);
  const version = await contractService.getVersion(
    paramId(req.params.id),
    paramId(req.params.versionId),
    orgId,
  );
  res.json({ data: { version } });
});

export const createVersion = asyncHandler(async (req: Request, res: Response) => {
  const orgId = getOrgId(req);
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
  const orgId = getOrgId(req);
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
