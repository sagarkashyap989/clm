import type { Types } from 'mongoose';
import { AuditLog } from '../models/AuditLog.js';

export async function writeAuditLog(input: {
  actorId?: Types.ObjectId | string | null;
  organizationId?: Types.ObjectId | string | null;
  action: string;
  resourceType: string;
  resourceId?: string | null;
  metadata?: Record<string, unknown>;
}): Promise<void> {
  await AuditLog.create({
    actorId: input.actorId ?? null,
    organizationId: input.organizationId ?? null,
    action: input.action,
    resourceType: input.resourceType,
    resourceId: input.resourceId ?? null,
    metadata: input.metadata ?? {},
  });
}
