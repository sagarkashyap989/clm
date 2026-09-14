import type { OrgRole } from '@cml/shared';
import { MembershipStatus } from '@cml/shared';
import type { NextFunction, Request, Response } from 'express';
import type { Types } from 'mongoose';
import { Membership } from '../models/Membership.js';
import { User } from '../models/User.js';
import { AppError } from '../utils/errors.js';
import { ACCESS_COOKIE } from '../utils/cookies.js';
import { verifyAccessToken } from '../utils/tokens.js';
import { asyncHandler } from './error.js';

export type AuthUser = {
  id: string;
  email: string;
  name: string;
  emailVerified: boolean;
};

export type AuthMembership = {
  id: string;
  organizationId: string;
  role: OrgRole;
  status: string;
};

declare global {
  namespace Express {
    interface Request {
      user?: AuthUser;
      membership?: AuthMembership;
    }
  }
}

export const requireAuth = asyncHandler(
  async (req: Request, _res: Response, next: NextFunction) => {
    const token = req.cookies?.[ACCESS_COOKIE] as string | undefined;
    if (!token) {
      throw new AppError(401, 'UNAUTHORIZED', 'Authentication required');
    }

    let payload;
    try {
      payload = verifyAccessToken(token);
    } catch {
      throw new AppError(401, 'UNAUTHORIZED', 'Invalid or expired access token');
    }

    const user = await User.findById(payload.sub);
    if (!user) {
      throw new AppError(401, 'UNAUTHORIZED', 'User not found');
    }

    req.user = {
      id: user._id.toString(),
      email: user.email,
      name: user.name,
      emailVerified: user.emailVerified,
    };
    next();
  },
);

export const requireOrgMember = asyncHandler(
  async (req: Request, _res: Response, next: NextFunction) => {
    if (!req.user) {
      throw new AppError(401, 'UNAUTHORIZED', 'Authentication required');
    }

    const organizationId = Array.isArray(req.params.id)
      ? req.params.id[0]
      : (req.params.id ?? (Array.isArray(req.params.organizationId)
          ? req.params.organizationId[0]
          : req.params.organizationId));
    if (!organizationId) {
      throw new AppError(400, 'BAD_REQUEST', 'Organization id is required');
    }

    const membership = await Membership.findOne({
      userId: req.user.id,
      organizationId,
      status: MembershipStatus.ACTIVE,
    });

    if (!membership) {
      throw new AppError(403, 'FORBIDDEN', 'You are not a member of this organization');
    }

    req.membership = {
      id: membership._id.toString(),
      organizationId: (membership.organizationId as Types.ObjectId).toString(),
      role: membership.role as OrgRole,
      status: membership.status,
    };
    next();
  },
);

export function requireRole(...roles: OrgRole[]) {
  return asyncHandler(async (req: Request, _res: Response, next: NextFunction) => {
    if (!req.membership) {
      throw new AppError(403, 'FORBIDDEN', 'Organization membership required');
    }
    if (!roles.includes(req.membership.role)) {
      throw new AppError(403, 'FORBIDDEN', 'Insufficient permissions');
    }
    next();
  });
}
