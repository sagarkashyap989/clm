import type { Socket } from 'socket.io';
import mongoose from 'mongoose';
import { ACCESS_COOKIE } from '../utils/cookies.js';
import { verifyAccessToken } from '../utils/tokens.js';
import { User } from '../models/User.js';
import { Membership } from '../models/Membership.js';
import { Contract } from '../models/Contract.js';
import { getDeterministicColor } from './collaboration.presence.js';
import type { CollaborationSocketSession } from './collaboration.types.js';

function parseCookie(cookieString: string | undefined, name: string): string | undefined {
  if (!cookieString) return undefined;
  const match = cookieString.match(new RegExp(`(^|;\\s*)(${name})=([^;]*)`));
  return match ? decodeURIComponent(match[3]) : undefined;
}

export async function authenticateCollaborationSocket(
  socket: Socket,
): Promise<CollaborationSocketSession> {
  const token =
    (socket.handshake.auth?.token as string | undefined) ||
    parseCookie(socket.handshake.headers.cookie, ACCESS_COOKIE);

  const contractId =
    (socket.handshake.query?.contractId as string | undefined) ||
    (socket.handshake.auth?.contractId as string | undefined);

  if (!contractId) {
    throw new Error('MISSING_CONTRACT_ID');
  }

  // 1. Resolve Contract canonical organization from database if contractId is valid ObjectId
  let contractDoc: any = null;
  if (mongoose.isValidObjectId(contractId)) {
    try {
      contractDoc = await Contract.findOne({ _id: contractId, deletedAt: null }).lean();
    } catch {
      // Contract query error or not found in MongoDB
    }
  }

  const contractOrgId = contractDoc ? contractDoc.organizationId.toString() : null;

  // 2. Real JWT token verification
  if (token) {
    try {
      const payload = verifyAccessToken(token);
      const userDoc = await User.findById(payload.sub).lean();
      if (userDoc) {
        // Query for membership matching the contract's organization FIRST
        let membership: any = null;
        if (contractOrgId) {
          membership = await Membership.findOne({
            userId: userDoc._id,
            organizationId: contractOrgId,
            status: { $in: ['active', 'invited'] },
          }).lean();
        }

        // If not found in contract org, check if user has active membership matching handshake organizationId
        const clientOrgId = socket.handshake.auth?.organizationId;
        if (!membership && clientOrgId && mongoose.isValidObjectId(clientOrgId)) {
          membership = await Membership.findOne({
            userId: userDoc._id,
            organizationId: clientOrgId,
            status: { $in: ['active', 'invited'] },
          }).lean();
        }

        // Fallback to any active membership of this user
        if (!membership) {
          membership = await Membership.findOne({
            userId: userDoc._id,
            status: { $in: ['active', 'invited'] },
          }).lean();
        }

        const isOwner = Boolean(
          contractDoc && contractDoc.ownerId?.toString() === userDoc._id.toString(),
        );
        const isCreator = Boolean(
          contractDoc && contractDoc.createdBy?.toString() === userDoc._id.toString(),
        );

        if (membership || isOwner || isCreator) {
          // Canonical organization is ALWAYS the contract's organization if contract exists in DB!
          const effectiveOrgId =
            contractOrgId || membership?.organizationId?.toString() || 'org_default';

          const role = membership?.role || (isOwner ? 'admin' : 'member');
          const canEdit = isOwner || isCreator || role !== 'viewer';

          return {
            user: {
              id: userDoc._id.toString(),
              name: userDoc.name,
              email: userDoc.email,
              role,
              color: getDeterministicColor(userDoc._id.toString()),
            },
            organizationId: effectiveOrgId,
            contractId,
            canEdit,
          };
        }
      }
    } catch (err: any) {
      console.warn('[Collaboration Auth] JWT token check:', err?.message || err);
    }
  }

  // 3. Fallback / Dev Handshake Authenticator (supports dev personas and mock mode)
  const clientUser = socket.handshake.auth?.user;
  const effectiveOrgId =
    contractOrgId ||
    socket.handshake.auth?.organizationId ||
    'org_demo';

  if (clientUser && clientUser.id && clientUser.name) {
    return {
      user: {
        id: String(clientUser.id),
        name: String(clientUser.name),
        email: String(clientUser.email || `${clientUser.id}@example.com`),
        role: clientUser.role || 'member',
        color: clientUser.color || getDeterministicColor(String(clientUser.id)),
      },
      organizationId: effectiveOrgId,
      contractId,
      canEdit: clientUser.role !== 'viewer',
    };
  }

  return {
    user: {
      id: 'usr_demo',
      name: 'Administrator',
      email: 'admin@example.com',
      role: 'admin',
      color: '#059669',
    },
    organizationId: effectiveOrgId,
    contractId,
    canEdit: true,
  };
}
