import type { Socket } from 'socket.io';
import { ACCESS_COOKIE } from '../utils/cookies.js';
import { verifyAccessToken } from '../utils/tokens.js';
import { User } from '../models/User.js';
import { Membership } from '../models/Membership.js';
import { Contract } from '../models/Contract.js';
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

  // 1. Try real JWT verification if token is present
  if (token) {
    try {
      const payload = verifyAccessToken(token);
      const userDoc = await User.findById(payload.sub);
      if (userDoc) {
        const membership = await Membership.findOne({
          userId: userDoc._id,
          status: 'active',
        });

        if (membership) {
          // Check contract exists and matches organization
          let canEdit = membership.role === 'admin' || membership.role === 'manager';
          try {
            const contractDoc = await Contract.findById(contractId);
            if (contractDoc) {
              if (contractDoc.organizationId.toString() !== membership.organizationId.toString()) {
                throw new Error('ORGANIZATION_FORBIDDEN');
              }
              // If member is owner, or role is admin/manager, they can edit
              if (contractDoc.ownerId.toString() === userDoc._id.toString()) {
                canEdit = true;
              }
            }
          } catch {
            // Mongoose query error or contract not found
          }

          return {
            user: {
              id: userDoc._id.toString(),
              name: userDoc.name,
              email: userDoc.email,
              role: membership.role,
              color: '#4f46e5',
            },
            organizationId: membership.organizationId.toString(),
            contractId,
            canEdit,
          };
        }
      }
    } catch (err: any) {
      if (err.message === 'ORGANIZATION_FORBIDDEN') {
        throw err;
      }
    }
  }

  // 2. Fallback / Dev Handshake Authenticator (supports dev personas e.g. Admin, Sarah Connor, John Doe)
  const clientUser = socket.handshake.auth?.user;
  const clientOrgId = socket.handshake.auth?.organizationId || 'org_demo';

  if (clientUser && clientUser.id && clientUser.name) {
    return {
      user: {
        id: String(clientUser.id),
        name: String(clientUser.name),
        email: String(clientUser.email || `${clientUser.id}@example.com`),
        role: clientUser.role || 'admin',
        color: clientUser.color || '#059669',
      },
      organizationId: clientOrgId,
      contractId,
      canEdit: clientUser.role !== 'viewer',
    };
  }

  // Default fallback user for unauthenticated requests
  return {
    user: {
      id: 'usr_demo',
      name: 'Administrator',
      email: 'admin@example.com',
      role: 'admin',
      color: '#059669',
    },
    organizationId: clientOrgId,
    contractId,
    canEdit: true,
  };
}
