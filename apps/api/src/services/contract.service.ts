import { MembershipStatus } from '@cml/shared';
import mongoose, { type Types } from 'mongoose';
import { Contract } from '../models/Contract.js';
import { DocumentVersion } from '../models/DocumentVersion.js';
import { Membership } from '../models/Membership.js';
import { writeAuditLog } from '../repositories/audit.repository.js';
import { AppError } from '../utils/errors.js';
import type {
  CreateContractInput,
  UpdateContractInput,
  ContractQueryInput,
  CreateVersionInput,
} from '@cml/shared';

export async function listContracts(
  organizationId: string | Types.ObjectId,
  params: ContractQueryInput,
) {
  const page = Math.max(1, Number(params.page) || 1);
  const limit = Math.min(100, Math.max(1, Number(params.limit) || 20));
  const skip = (page - 1) * limit;

  const filter: Record<string, unknown> = {
    organizationId,
    deletedAt: null,
  };

  if (params.status && params.status !== 'all') {
    filter.status = params.status;
  }

  if (params.type && params.type !== 'all') {
    filter.type = params.type;
  }

  if (params.search && params.search.trim()) {
    const term = params.search.trim();
    filter.$or = [
      { name: { $regex: term, $options: 'i' } },
      { counterparty: { $regex: term, $options: 'i' } },
      { description: { $regex: term, $options: 'i' } },
      { tags: { $regex: term, $options: 'i' } },
    ];
  }

  let sortObj: Record<string, 1 | -1> = { updatedAt: -1 };
  if (params.sort === 'updatedAt_asc') sortObj = { updatedAt: 1 };
  else if (params.sort === 'createdAt_desc') sortObj = { createdAt: -1 };
  else if (params.sort === 'name_asc') sortObj = { name: 1 };
  else if (params.sort === 'name_desc') sortObj = { name: -1 };
  else if (params.sort === 'endDate_asc') sortObj = { endDate: 1 };

  const [contracts, total] = await Promise.all([
    Contract.find(filter)
      .populate('ownerId', 'name email')
      .populate('createdBy', 'name email')
      .sort(sortObj)
      .skip(skip)
      .limit(limit)
      .lean(),
    Contract.countDocuments(filter),
  ]);

  return {
    contracts: contracts.map((c) => ({
      id: c._id.toString(),
      name: c.name,
      type: c.type,
      status: c.status,
      description: c.description,
      counterparty: c.counterparty,
      startDate: c.startDate ? c.startDate.toISOString() : null,
      endDate: c.endDate ? c.endDate.toISOString() : null,
      tags: c.tags ?? [],
      originalFile: c.originalFile ?? null,
      currentVersionNumber: c.currentVersionNumber,
      owner: c.ownerId,
      createdBy: c.createdBy,
      createdAt: c.createdAt?.toISOString(),
      updatedAt: c.updatedAt?.toISOString(),
    })),
    pagination: {
      page,
      limit,
      total,
      totalPages: Math.ceil(total / limit) || 1,
    },
  };
}

export async function resolveAccessibleOrganization(
  contractId: string,
  userId: string,
): Promise<string> {
  if (!mongoose.isValidObjectId(contractId)) {
    throw new AppError(404, 'CONTRACT_NOT_FOUND', 'Contract not found');
  }

  const contract = await Contract.findOne({ _id: contractId, deletedAt: null }).lean();
  if (!contract) {
    throw new AppError(404, 'CONTRACT_NOT_FOUND', 'Contract not found');
  }

  const contractOrgId = contract.organizationId.toString();
  const membership = await Membership.findOne({
    userId,
    organizationId: contractOrgId,
    status: MembershipStatus.ACTIVE,
  });

  if (!membership) {
    throw new AppError(404, 'CONTRACT_NOT_FOUND', 'Contract not found');
  }

  return contractOrgId;
}

export async function getContract(
  contractId: string,
  organizationId: string | Types.ObjectId,
) {
  const contract = await Contract.findOne({
    _id: contractId,
    organizationId,
    deletedAt: null,
  })
    .populate('ownerId', 'name email')
    .populate('createdBy', 'name email')
    .lean();

  if (!contract) {
    throw new AppError(404, 'CONTRACT_NOT_FOUND', 'Contract not found');
  }

  return {
    id: contract._id.toString(),
    name: contract.name,
    type: contract.type,
    status: contract.status,
    description: contract.description,
    counterparty: contract.counterparty,
    startDate: contract.startDate ? contract.startDate.toISOString() : null,
    endDate: contract.endDate ? contract.endDate.toISOString() : null,
    tags: contract.tags ?? [],
    originalFile: contract.originalFile ?? null,
    currentVersionNumber: contract.currentVersionNumber,
    owner: contract.ownerId,
    createdBy: contract.createdBy,
    createdAt: contract.createdAt?.toISOString(),
    updatedAt: contract.updatedAt?.toISOString(),
  };
}

export async function createContract(
  organizationId: string,
  userId: string,
  input: CreateContractInput,
) {
  const contract = await Contract.create({
    organizationId,
    name: input.name,
    type: input.type,
    description: input.description ?? '',
    counterparty: input.counterparty ?? '',
    ownerId: userId,
    startDate: input.startDate ? new Date(input.startDate) : null,
    endDate: input.endDate ? new Date(input.endDate) : null,
    tags: input.tags ?? [],
    originalFile: input.file
      ? {
          fileName: input.file.fileName,
          mimeType: input.file.mimeType,
          size: input.file.size,
          storageKey: input.file.storageKey ?? `contracts/${organizationId}/${Date.now()}-${input.file.fileName}`,
          uploadedAt: new Date(),
        }
      : undefined,
    createdBy: userId,
    status: 'draft',
  });

  await writeAuditLog({
    actorId: userId,
    organizationId,
    action: 'CONTRACT_CREATED',
    resourceType: 'contract',
    resourceId: contract._id.toString(),
    metadata: {
      name: contract.name,
      type: contract.type,
      hasFile: Boolean(input.file),
    },
  });

  return getContract(contract._id.toString(), organizationId);
}

export async function updateContract(
  contractId: string,
  organizationId: string,
  userId: string,
  input: UpdateContractInput,
) {
  const contract = await Contract.findOne({
    _id: contractId,
    organizationId,
    deletedAt: null,
  });

  if (!contract) {
    throw new AppError(404, 'CONTRACT_NOT_FOUND', 'Contract not found');
  }

  const previousStatus = contract.status;

  if (input.name !== undefined) contract.name = input.name;
  if (input.type !== undefined) contract.type = input.type;
  if (input.description !== undefined) contract.description = input.description;
  if (input.counterparty !== undefined) contract.counterparty = input.counterparty;
  if (input.startDate !== undefined) {
    contract.startDate = input.startDate ? new Date(input.startDate) : null;
  }
  if (input.endDate !== undefined) {
    contract.endDate = input.endDate ? new Date(input.endDate) : null;
  }
  if (input.tags !== undefined) contract.tags = input.tags;
  if (input.status !== undefined) contract.status = input.status;

  await contract.save();

  if (input.status && input.status !== previousStatus) {
    await writeAuditLog({
      actorId: userId,
      organizationId,
      action: 'CONTRACT_STATUS_CHANGED',
      resourceType: 'contract',
      resourceId: contract._id.toString(),
      metadata: { from: previousStatus, to: input.status },
    });
  } else {
    await writeAuditLog({
      actorId: userId,
      organizationId,
      action: 'CONTRACT_UPDATED',
      resourceType: 'contract',
      resourceId: contract._id.toString(),
      metadata: { updatedFields: Object.keys(input) },
    });
  }

  return getContract(contractId, organizationId);
}

export async function deleteContract(
  contractId: string,
  organizationId: string,
  userId: string,
) {
  const contract = await Contract.findOne({
    _id: contractId,
    organizationId,
    deletedAt: null,
  });

  if (!contract) {
    throw new AppError(404, 'CONTRACT_NOT_FOUND', 'Contract not found');
  }

  contract.deletedAt = new Date();
  await contract.save();

  await writeAuditLog({
    actorId: userId,
    organizationId,
    action: 'CONTRACT_DELETED',
    resourceType: 'contract',
    resourceId: contractId,
    metadata: { name: contract.name },
  });

  return { ok: true };
}

export async function getDashboardSummary(
  organizationId: string,
  _userId: string,
) {
  const baseFilter = { organizationId, deletedAt: null };

  const [totalCount, pendingReviewCount, inReviewCount, recentContracts, pendingContracts] =
    await Promise.all([
      Contract.countDocuments(baseFilter),
      Contract.countDocuments({
        ...baseFilter,
        status: { $in: ['in_review', 'changes_requested', 'pending_signature'] },
      }),
      Contract.countDocuments({
        ...baseFilter,
        updatedAt: { $gte: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000) },
      }),
      Contract.find(baseFilter)
        .populate('ownerId', 'name email')
        .sort({ updatedAt: -1 })
        .limit(5)
        .lean(),
      Contract.find({
        ...baseFilter,
        status: { $in: ['in_review', 'changes_requested', 'pending_signature'] },
      })
        .populate('ownerId', 'name email')
        .sort({ updatedAt: -1 })
        .limit(5)
        .lean(),
    ]);

  const mapContract = (c: any) => ({
    id: c._id.toString(),
    name: c.name,
    type: c.type,
    status: c.status,
    counterparty: c.counterparty,
    owner: c.ownerId,
    updatedAt: c.updatedAt?.toISOString(),
  });

  return {
    metrics: {
      totalContracts: totalCount,
      pendingReview: pendingReviewCount,
      recentlyUpdated: inReviewCount,
      sharedWithMe: 0, // Placeholder until Phase 4 sharing
    },
    recentContracts: recentContracts.map(mapContract),
    pendingContracts: pendingContracts.map(mapContract),
  };
}

export async function listVersions(contractId: string, organizationId: string) {
  const contract = await Contract.findOne({
    _id: contractId,
    organizationId,
    deletedAt: null,
  });

  if (!contract) {
    throw new AppError(404, 'CONTRACT_NOT_FOUND', 'Contract not found');
  }

  const versions = await DocumentVersion.find({
    contractId,
    organizationId,
  })
    .populate('createdBy', 'name email')
    .sort({ versionNumber: -1 })
    .lean();

  return versions.map((v) => ({
    id: v._id.toString(),
    contractId: v.contractId.toString(),
    versionNumber: v.versionNumber,
    createdBy: v.createdBy,
    source: v.source,
    file: v.file ?? null,
    editorContent: v.editorContent,
    changeDescription: v.changeDescription,
    createdAt: v.createdAt?.toISOString(),
  }));
}

export async function getVersion(
  contractId: string,
  versionId: string,
  organizationId: string,
) {
  const version = await DocumentVersion.findOne({
    _id: versionId,
    contractId,
    organizationId,
  })
    .populate('createdBy', 'name email')
    .lean();

  if (!version) {
    throw new AppError(404, 'VERSION_NOT_FOUND', 'Document version not found');
  }

  return {
    id: version._id.toString(),
    contractId: version.contractId.toString(),
    versionNumber: version.versionNumber,
    createdBy: version.createdBy,
    source: version.source,
    file: version.file ?? null,
    editorContent: version.editorContent,
    changeDescription: version.changeDescription,
    createdAt: version.createdAt?.toISOString(),
  };
}

export async function createVersion(
  contractId: string,
  organizationId: string,
  userId: string,
  input: CreateVersionInput,
) {
  const contract = await Contract.findOne({
    _id: contractId,
    organizationId,
    deletedAt: null,
  });

  if (!contract) {
    throw new AppError(404, 'CONTRACT_NOT_FOUND', 'Contract not found');
  }

  const nextVersionNumber = (contract.currentVersionNumber || 1) + 1;

  const version = await DocumentVersion.create({
    contractId,
    organizationId,
    versionNumber: nextVersionNumber,
    createdBy: userId,
    source: 'editor',
    editorContent: input.editorContent,
    changeDescription: input.changeDescription || `Version ${nextVersionNumber}`,
  });

  contract.currentVersionNumber = nextVersionNumber;
  await contract.save();

  await writeAuditLog({
    actorId: userId,
    organizationId,
    action: 'CONTRACT_VERSION_CREATED',
    resourceType: 'contract',
    resourceId: contractId,
    metadata: {
      versionNumber: nextVersionNumber,
      changeDescription: input.changeDescription,
    },
  });

  return getVersion(contractId, version._id.toString(), organizationId);
}

export async function restoreVersion(
  contractId: string,
  versionId: string,
  organizationId: string,
  userId: string,
  changeDescription?: string,
) {
  const contract = await Contract.findOne({
    _id: contractId,
    organizationId,
    deletedAt: null,
  });

  if (!contract) {
    throw new AppError(404, 'CONTRACT_NOT_FOUND', 'Contract not found');
  }

  const previousVersion = await DocumentVersion.findOne({
    _id: versionId,
    contractId,
    organizationId,
  });

  if (!previousVersion) {
    throw new AppError(404, 'VERSION_NOT_FOUND', 'Version to restore not found');
  }

  const nextVersionNumber = (contract.currentVersionNumber || 1) + 1;

  const restored = await DocumentVersion.create({
    contractId,
    organizationId,
    versionNumber: nextVersionNumber,
    createdBy: userId,
    source: 'restore',
    file: previousVersion.file,
    editorContent: previousVersion.editorContent,
    changeDescription:
      changeDescription || `Restored from Version ${previousVersion.versionNumber}`,
  });

  contract.currentVersionNumber = nextVersionNumber;
  await contract.save();

  await writeAuditLog({
    actorId: userId,
    organizationId,
    action: 'CONTRACT_VERSION_RESTORED',
    resourceType: 'contract',
    resourceId: contractId,
    metadata: {
      restoredFromVersion: previousVersion.versionNumber,
      newVersionNumber: nextVersionNumber,
    },
  });

  return getVersion(contractId, restored._id.toString(), organizationId);
}
