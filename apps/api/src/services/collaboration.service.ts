import type { Types } from 'mongoose';
import { MembershipStatus } from '@cml/shared';
import type {
  CreateChatMessageInput,
  CreateCommentInput,
  ReplyCommentInput,
} from '@cml/shared';
import { Contract } from '../models/Contract.js';
import { ContractChatMessage } from '../models/ContractChatMessage.js';
import { ContractComment } from '../models/ContractComment.js';
import { Membership } from '../models/Membership.js';
import { Notification } from '../models/Notification.js';
import { User } from '../models/User.js';
import { AppError } from '../utils/errors.js';

type LeanUser = { _id: Types.ObjectId; name: string; email: string };

function asLeanUser(value: unknown): LeanUser | undefined {
  if (!value || typeof value !== 'object') {
    return undefined;
  }
  const user = value as { _id?: Types.ObjectId; name?: unknown; email?: unknown };
  if (!user._id || typeof user.name !== 'string' || typeof user.email !== 'string') {
    return undefined;
  }
  return { _id: user._id, name: user.name, email: user.email };
}

function publicUser(user?: LeanUser | null) {
  if (!user) {
    return { id: '', name: 'Unknown', email: '' };
  }
  return {
    id: user._id.toString(),
    name: user.name,
    email: user.email,
  };
}

async function requireContract(contractId: string, organizationId: string) {
  const contract = await Contract.findOne({
    _id: contractId,
    organizationId,
    deletedAt: null,
  });
  if (!contract) {
    throw new AppError(404, 'CONTRACT_NOT_FOUND', 'Contract not found');
  }
  return contract;
}

function serializeComment(comment: {
  _id: Types.ObjectId;
  contractId: Types.ObjectId;
  versionNumber?: number | null;
  quoteText?: string | null;
  content: string;
  authorId: LeanUser | Types.ObjectId;
  replies?: Array<{
    _id: Types.ObjectId;
    content: string;
    authorId: LeanUser | Types.ObjectId;
    createdAt?: Date;
  }>;
  isResolved: boolean;
  resolvedById?: LeanUser | Types.ObjectId | null;
  resolvedAt?: Date | null;
  createdAt?: Date;
}) {
  const author = asLeanUser(comment.authorId);
  const resolvedBy = asLeanUser(comment.resolvedById);
  return {
    id: comment._id.toString(),
    contractId: comment.contractId.toString(),
    versionNumber: comment.versionNumber ?? 1,
    quoteText: comment.quoteText || undefined,
    content: comment.content,
    author: publicUser(author),
    replies: (comment.replies ?? []).map((reply) => ({
      id: reply._id.toString(),
      content: reply.content,
      author: publicUser(asLeanUser(reply.authorId)),
      createdAt: reply.createdAt?.toISOString() ?? new Date().toISOString(),
    })),
    isResolved: comment.isResolved,
    resolvedBy: resolvedBy ? { id: resolvedBy._id.toString(), name: resolvedBy.name } : null,
    resolvedAt: comment.resolvedAt?.toISOString() ?? null,
    createdAt: comment.createdAt?.toISOString() ?? new Date().toISOString(),
  };
}

async function notifyOrgMembers(input: {
  organizationId: string;
  actorId: string;
  contractId: string;
  contractName: string;
  title: string;
  message: string;
  type: 'comment' | 'share' | 'status' | 'version';
}) {
  const members = await Membership.find({
    organizationId: input.organizationId,
    status: MembershipStatus.ACTIVE,
    userId: { $ne: input.actorId },
  });
  if (members.length === 0) return;
  await Notification.insertMany(
    members.map((member) => ({
      userId: member.userId,
      organizationId: input.organizationId,
      contractId: input.contractId,
      contractName: input.contractName,
      title: input.title,
      message: input.message,
      type: input.type,
      isRead: false,
    })),
  );
}

export async function listComments(contractId: string, organizationId: string) {
  await requireContract(contractId, organizationId);
  const comments = await ContractComment.find({ contractId, organizationId })
    .populate('authorId', 'name email')
    .populate('resolvedById', 'name email')
    .populate('replies.authorId', 'name email')
    .sort({ createdAt: -1 })
    .lean();
  return comments.map((comment) => serializeComment(comment as never));
}

export async function createComment(
  contractId: string,
  organizationId: string,
  userId: string,
  input: CreateCommentInput,
) {
  const contract = await requireContract(contractId, organizationId);
  const comment = await ContractComment.create({
    organizationId,
    contractId,
    content: input.content,
    quoteText: input.quoteText ?? '',
    versionNumber: input.versionNumber ?? contract.currentVersionNumber ?? 1,
    authorId: userId,
  });
  const author = await User.findById(userId).lean();
  await notifyOrgMembers({
    organizationId,
    actorId: userId,
    contractId,
    contractName: contract.name,
    title: 'New Comment Posted',
    message: `${author?.name ?? 'A teammate'} commented: "${input.content.slice(0, 45)}"`,
    type: 'comment',
  });
  const created = await ContractComment.findById(comment._id)
    .populate('authorId', 'name email')
    .populate('resolvedById', 'name email')
    .populate('replies.authorId', 'name email')
    .lean();
  return serializeComment(created as never);
}

export async function replyToComment(
  contractId: string,
  commentId: string,
  organizationId: string,
  userId: string,
  input: ReplyCommentInput,
) {
  const comment = await ContractComment.findOne({
    _id: commentId,
    contractId,
    organizationId,
  });
  if (!comment) {
    throw new AppError(404, 'NOT_FOUND', 'Comment not found');
  }
  comment.replies.push({ content: input.content, authorId: userId } as never);
  await comment.save();
  const updated = await ContractComment.findById(comment._id)
    .populate('authorId', 'name email')
    .populate('resolvedById', 'name email')
    .populate('replies.authorId', 'name email')
    .lean();
  const last = updated?.replies?.at(-1);
  return {
    id: last?._id.toString(),
    content: last?.content,
    author: publicUser(asLeanUser(last?.authorId)),
    createdAt: (last as { createdAt?: Date } | undefined)?.createdAt?.toISOString(),
  };
}

export async function toggleCommentResolved(
  contractId: string,
  commentId: string,
  organizationId: string,
  userId: string,
) {
  const comment = await ContractComment.findOne({
    _id: commentId,
    contractId,
    organizationId,
  });
  if (!comment) {
    throw new AppError(404, 'NOT_FOUND', 'Comment not found');
  }
  comment.isResolved = !comment.isResolved;
  comment.resolvedById = comment.isResolved ? (userId as never) : null;
  comment.resolvedAt = comment.isResolved ? new Date() : null;
  await comment.save();
  const updated = await ContractComment.findById(comment._id)
    .populate('authorId', 'name email')
    .populate('resolvedById', 'name email')
    .populate('replies.authorId', 'name email')
    .lean();
  return serializeComment(updated as never);
}

export async function deleteComment(
  contractId: string,
  commentId: string,
  organizationId: string,
  userId: string,
) {
  const comment = await ContractComment.findOne({
    _id: commentId,
    contractId,
    organizationId,
  });
  if (!comment) {
    throw new AppError(404, 'NOT_FOUND', 'Comment not found');
  }
  if (comment.authorId.toString() !== userId) {
    throw new AppError(403, 'FORBIDDEN', 'You can only delete your own comments');
  }
  await comment.deleteOne();
  return { ok: true };
}

export async function listChat(contractId: string, organizationId: string) {
  await requireContract(contractId, organizationId);
  const messages = await ContractChatMessage.find({ contractId, organizationId })
    .populate('senderId', 'name email')
    .sort({ createdAt: 1 })
    .lean();
  return messages.map((message) => ({
    id: message._id.toString(),
    contractId: message.contractId.toString(),
    content: message.content,
    sender: publicUser(asLeanUser(message.senderId)),
    type: message.type,
    createdAt: message.createdAt?.toISOString() ?? new Date().toISOString(),
  }));
}

export async function createChatMessage(
  contractId: string,
  organizationId: string,
  userId: string,
  input: CreateChatMessageInput,
) {
  await requireContract(contractId, organizationId);
  const message = await ContractChatMessage.create({
    organizationId,
    contractId,
    content: input.content,
    senderId: userId,
    type: 'message',
  });
  const created = await ContractChatMessage.findById(message._id)
    .populate('senderId', 'name email')
    .lean();
  return {
    id: created!._id.toString(),
    contractId: created!.contractId.toString(),
    content: created!.content,
    sender: publicUser(asLeanUser(created!.senderId)),
    type: created!.type,
    createdAt: created!.createdAt?.toISOString() ?? new Date().toISOString(),
  };
}

export async function getDraft(contractId: string, organizationId: string) {
  const contract = await requireContract(contractId, organizationId);
  return { draftContent: contract.draftContent ?? null };
}

export async function saveDraft(
  contractId: string,
  organizationId: string,
  editorContent: string,
) {
  const contract = await requireContract(contractId, organizationId);
  contract.draftContent = editorContent;
  await contract.save();
  return { savedAt: new Date().toISOString() };
}

export async function listNotifications(userId: string) {
  const notifications = await Notification.find({ userId }).sort({ createdAt: -1 }).limit(50).lean();
  return notifications.map((item) => ({
    id: item._id.toString(),
    userId: item.userId.toString(),
    contractId: item.contractId ? item.contractId.toString() : undefined,
    invitationId: item.invitationId ? item.invitationId.toString() : undefined,
    contractName: item.contractName || undefined,
    title: item.title,
    message: item.message,
    type: item.type,
    isRead: item.isRead,
    createdAt: item.createdAt?.toISOString() ?? new Date().toISOString(),
  }));
}

export async function markNotificationRead(notificationId: string, userId: string) {
  await Notification.findOneAndUpdate({ _id: notificationId, userId }, { isRead: true });
  return { ok: true };
}

export async function markAllNotificationsRead(userId: string) {
  await Notification.updateMany({ userId, isRead: false }, { isRead: true });
  return { ok: true };
}
