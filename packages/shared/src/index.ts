import { z } from 'zod';

export const OrgRole = {
  ADMIN: 'admin',
  MANAGER: 'manager',
  MEMBER: 'member',
} as const;

export type OrgRole = (typeof OrgRole)[keyof typeof OrgRole];

export const ORG_ROLES = [OrgRole.ADMIN, OrgRole.MANAGER, OrgRole.MEMBER] as const;

export const MembershipStatus = {
  ACTIVE: 'active',
  INVITED: 'invited',
  REMOVED: 'removed',
} as const;

export type MembershipStatus =
  (typeof MembershipStatus)[keyof typeof MembershipStatus];

export const passwordSchema = z
  .string()
  .min(8, 'Password must be at least 8 characters');

export const registerSchema = z.object({
  name: z.string().min(1).max(120),
  email: z.string().email(),
  password: passwordSchema,
  organizationName: z.string().min(1).max(200).optional(),
  inviteToken: z.string().min(1).optional(),
}).refine(
  (data) => Boolean(data.organizationName) || Boolean(data.inviteToken),
  { message: 'Either organizationName or inviteToken is required', path: ['organizationName'] },
);

export const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
});

export const forgotPasswordSchema = z.object({
  email: z.string().email(),
});

export const resetPasswordSchema = z.object({
  token: z.string().min(1),
  password: passwordSchema,
});

export const changePasswordSchema = z.object({
  currentPassword: z.string().min(1),
  newPassword: passwordSchema,
});

export const updateProfileSchema = z.object({
  name: z.string().min(1).max(120),
});

export const updateOrganizationSchema = z.object({
  name: z.string().min(1).max(200),
});

export const inviteMemberSchema = z.object({
  email: z.string().email(),
  role: z.enum(ORG_ROLES),
});

export const updateMemberSchema = z.object({
  role: z.enum(ORG_ROLES),
});

export const ContractStatus = {
  DRAFT: 'draft',
  IN_REVIEW: 'in_review',
  CHANGES_REQUESTED: 'changes_requested',
  APPROVED: 'approved',
  PENDING_SIGNATURE: 'pending_signature',
  COMPLETED: 'completed',
  ARCHIVED: 'archived',
} as const;

export type ContractStatus = (typeof ContractStatus)[keyof typeof ContractStatus];

export const CONTRACT_STATUSES = [
  ContractStatus.DRAFT,
  ContractStatus.IN_REVIEW,
  ContractStatus.CHANGES_REQUESTED,
  ContractStatus.APPROVED,
  ContractStatus.PENDING_SIGNATURE,
  ContractStatus.COMPLETED,
  ContractStatus.ARCHIVED,
] as const;

export const ContractType = {
  NDA: 'nda',
  EMPLOYMENT: 'employment',
  VENDOR: 'vendor',
  SERVICE: 'service',
  LICENSING: 'licensing',
  LEASE: 'lease',
  PARTNERSHIP: 'partnership',
  PURCHASE: 'purchase',
  OTHER: 'other',
} as const;

export type ContractType = (typeof ContractType)[keyof typeof ContractType];

export const CONTRACT_TYPES = [
  ContractType.NDA,
  ContractType.EMPLOYMENT,
  ContractType.VENDOR,
  ContractType.SERVICE,
  ContractType.LICENSING,
  ContractType.LEASE,
  ContractType.PARTNERSHIP,
  ContractType.PURCHASE,
  ContractType.OTHER,
] as const;

export const CONTRACT_TYPE_LABELS: Record<ContractType, string> = {
  [ContractType.NDA]: 'Non-Disclosure Agreement (NDA)',
  [ContractType.EMPLOYMENT]: 'Employment Agreement',
  [ContractType.VENDOR]: 'Vendor Agreement',
  [ContractType.SERVICE]: 'Service Agreement',
  [ContractType.LICENSING]: 'Licensing Agreement',
  [ContractType.LEASE]: 'Lease Agreement',
  [ContractType.PARTNERSHIP]: 'Partnership Agreement',
  [ContractType.PURCHASE]: 'Purchase Agreement',
  [ContractType.OTHER]: 'Other Document',
};

export const CONTRACT_STATUS_LABELS: Record<ContractStatus, string> = {
  [ContractStatus.DRAFT]: 'Draft',
  [ContractStatus.IN_REVIEW]: 'In Review',
  [ContractStatus.CHANGES_REQUESTED]: 'Changes Requested',
  [ContractStatus.APPROVED]: 'Approved',
  [ContractStatus.PENDING_SIGNATURE]: 'Pending Signature',
  [ContractStatus.COMPLETED]: 'Completed',
  [ContractStatus.ARCHIVED]: 'Archived',
};

export const createContractSchema = z.object({
  name: z.string().min(1, 'Contract name is required').max(200),
  type: z.enum(CONTRACT_TYPES),
  description: z.string().max(1000).optional(),
  counterparty: z.string().max(200).optional(),
  startDate: z.string().optional(),
  endDate: z.string().optional(),
  tags: z.array(z.string()).optional(),
  file: z
    .object({
      fileName: z.string(),
      mimeType: z.string(),
      size: z.number(),
      storageKey: z.string().optional(),
      base64Data: z.string().optional(),
    })
    .optional(),
});

export const updateContractSchema = z.object({
  name: z.string().min(1).max(200).optional(),
  type: z.enum(CONTRACT_TYPES).optional(),
  status: z.enum(CONTRACT_STATUSES).optional(),
  description: z.string().max(1000).optional(),
  counterparty: z.string().max(200).optional(),
  startDate: z.string().optional(),
  endDate: z.string().optional(),
  tags: z.array(z.string()).optional(),
});

export const contractQuerySchema = z.object({
  search: z.string().optional(),
  status: z.string().optional(),
  type: z.string().optional(),
  sort: z.string().optional(),
  page: z.coerce.number().min(1).default(1),
  limit: z.coerce.number().min(1).max(100).default(20),
});

export type CreateContractInput = z.infer<typeof createContractSchema>;
export type UpdateContractInput = z.infer<typeof updateContractSchema>;
export type ContractQueryInput = z.infer<typeof contractQuerySchema>;

export const VersionSource = {
  UPLOAD: 'upload',
  EDITOR: 'editor',
  RESTORE: 'restore',
} as const;

export type VersionSource = (typeof VersionSource)[keyof typeof VersionSource];

export const createVersionSchema = z.object({
  editorContent: z.string().min(1, 'Editor content is required'),
  changeDescription: z.string().min(1, 'Please provide a brief description of the changes').max(500),
});

export const restoreVersionSchema = z.object({
  changeDescription: z.string().max(500).optional(),
});

export const saveDraftSchema = z.object({
  editorContent: z.string(),
});

export type CreateVersionInput = z.infer<typeof createVersionSchema>;
export type RestoreVersionInput = z.infer<typeof restoreVersionSchema>;
export type SaveDraftInput = z.infer<typeof saveDraftSchema>;

export type DocumentVersion = {
  id: string;
  contractId: string;
  versionNumber: number;
  createdBy: {
    id: string;
    name: string;
    email: string;
  };
  source: VersionSource;
  file?: {
    fileName: string;
    mimeType: string;
    size: number;
    storageKey?: string;
  } | null;
  editorContent: string;
  changeDescription: string;
  createdAt: string;
};

// ========================
// PHASE 4: COLLABORATION
// ========================

export const SharePermission = {
  VIEWER: 'viewer',
  REVIEWER: 'reviewer',
  EDITOR: 'editor',
  APPROVER: 'approver',
} as const;

export type SharePermission = (typeof SharePermission)[keyof typeof SharePermission];

export const SHARE_PERMISSION_LABELS: Record<SharePermission, string> = {
  viewer: 'Viewer (Read-Only)',
  reviewer: 'Reviewer (Comments & Suggestions)',
  editor: 'Editor (Direct Edits & Redlines)',
  approver: 'Approver (Approval Sign-Off)',
};

export const shareContractSchema = z.object({
  type: z.enum(['internal', 'external_link']).default('internal'),
  permission: z.enum(['viewer', 'reviewer', 'editor', 'approver']).default('reviewer'),
  userId: z.string().optional(),
  userEmail: z.string().email().optional(),
  expiresInDays: z.number().min(1).max(365).optional(),
});

export type ShareContractInput = z.infer<typeof shareContractSchema>;

export type ContractShare = {
  id: string;
  contractId: string;
  type: 'internal' | 'external_link';
  permission: SharePermission;
  sharedWithUser?: {
    id: string;
    name: string;
    email: string;
  } | null;
  shareToken?: string;
  shareUrl?: string;
  expiresAt?: string | null;
  createdAt: string;
  createdBy: {
    id: string;
    name: string;
    email: string;
  };
};

export const createCommentSchema = z.object({
  content: z.string().min(1, 'Comment cannot be empty').max(2000),
  quoteText: z.string().optional(),
  versionNumber: z.number().optional(),
});

export const replyCommentSchema = z.object({
  content: z.string().min(1, 'Reply cannot be empty').max(2000),
});

export type CreateCommentInput = z.infer<typeof createCommentSchema>;
export type ReplyCommentInput = z.infer<typeof replyCommentSchema>;

export type CommentReply = {
  id: string;
  content: string;
  author: {
    id: string;
    name: string;
    email: string;
  };
  createdAt: string;
};

export type ContractComment = {
  id: string;
  contractId: string;
  versionNumber?: number;
  quoteText?: string;
  content: string;
  author: {
    id: string;
    name: string;
    email: string;
  };
  replies: CommentReply[];
  isResolved: boolean;
  resolvedBy?: {
    id: string;
    name: string;
  } | null;
  resolvedAt?: string | null;
  createdAt: string;
};

export const createChatMessageSchema = z.object({
  content: z.string().min(1, 'Message cannot be empty').max(2000),
});

export type CreateChatMessageInput = z.infer<typeof createChatMessageSchema>;

export type ContractChatMessage = {
  id: string;
  contractId: string;
  content: string;
  sender: {
    id: string;
    name: string;
    email: string;
  };
  type: 'message' | 'system';
  createdAt: string;
};

export type NotificationType = 'share' | 'comment' | 'status' | 'version';

export type NotificationItem = {
  id: string;
  userId: string;
  contractId?: string;
  contractName?: string;
  title: string;
  message: string;
  type: NotificationType;
  isRead: boolean;
  createdAt: string;
};

export type RegisterInput = z.infer<typeof registerSchema>;
export type LoginInput = z.infer<typeof loginSchema>;
export type InviteMemberInput = z.infer<typeof inviteMemberSchema>;

export type ApiErrorBody = {
  error: {
    code: string;
    message: string;
    details?: unknown;
  };
};

export type ApiSuccess<T> = {
  data: T;
};
