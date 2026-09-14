import {
  MembershipStatus,
  OrgRole,
  type LoginInput,
  type RegisterInput,
} from '@cml/shared';
import mongoose from 'mongoose';
import { Invitation } from '../models/Invitation.js';
import { Membership } from '../models/Membership.js';
import { Organization } from '../models/Organization.js';
import { User } from '../models/User.js';
import { writeAuditLog } from '../repositories/audit.repository.js';
import { AppError } from '../utils/errors.js';
import {
  sendPasswordResetEmail,
  sendVerificationEmail,
} from '../utils/email.js';
import {
  createToken,
  hashPassword,
  hashToken,
  signAccessToken,
  signRefreshToken,
  verifyPassword,
  verifyRefreshToken,
  verifyTokenHash,
} from '../utils/tokens.js';

function publicUser(user: {
  _id: mongoose.Types.ObjectId;
  email: string;
  name: string;
  emailVerified: boolean;
}) {
  return {
    id: user._id.toString(),
    email: user.email,
    name: user.name,
    emailVerified: user.emailVerified,
  };
}

async function issueSession(userId: string) {
  const jti = createToken();
  const accessToken = signAccessToken(userId);
  const refreshToken = signRefreshToken(userId, jti);
  const refreshTokenHash = await hashToken(refreshToken);
  await User.findByIdAndUpdate(userId, { refreshTokenHash });
  return { accessToken, refreshToken };
}

export async function register(input: RegisterInput) {
  const existing = await User.findOne({ email: input.email.toLowerCase() });
  if (existing) {
    throw new AppError(409, 'EMAIL_IN_USE', 'Email is already registered');
  }

  const passwordHash = await hashPassword(input.password);
  const emailVerificationToken = createToken();
  const emailVerificationTokenHash = await hashToken(emailVerificationToken);

  let matchedInvite = null;
  if (input.inviteToken) {
    const invitations = await Invitation.find({
      email: input.email.toLowerCase(),
      acceptedAt: null,
      expiresAt: { $gt: new Date() },
    });

    for (const invite of invitations) {
      if (await verifyTokenHash(input.inviteToken, invite.tokenHash)) {
        matchedInvite = invite;
        break;
      }
    }

    if (!matchedInvite) {
      throw new AppError(400, 'INVALID_INVITE', 'Invitation is invalid or expired');
    }
  }

  const user = await User.create({
    email: input.email.toLowerCase(),
    name: input.name,
    passwordHash,
    emailVerified: false,
    emailVerificationTokenHash,
    emailVerificationExpiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000),
  });

  try {
    let organization;
    let role: OrgRole = OrgRole.ADMIN;

    if (matchedInvite) {
      organization = await Organization.findById(matchedInvite.organizationId);
      if (!organization) {
        throw new AppError(404, 'ORG_NOT_FOUND', 'Organization not found');
      }
      role = matchedInvite.role as OrgRole;
      matchedInvite.acceptedAt = new Date();
      await matchedInvite.save();
    } else {
      organization = await Organization.create({
        name: input.organizationName,
        createdBy: user._id,
      });
    }

    await Membership.create({
      userId: user._id,
      organizationId: organization._id,
      role,
      status: MembershipStatus.ACTIVE,
    });

    await writeAuditLog({
      actorId: user._id,
      organizationId: organization._id,
      action: 'user.registered',
      resourceType: 'user',
      resourceId: user._id.toString(),
      metadata: { viaInvite: Boolean(input.inviteToken) },
    });

    try {
      await sendVerificationEmail(user.email, user.name, emailVerificationToken);
    } catch (error) {
      console.error('Failed to send verification email', error);
    }

    const tokens = await issueSession(user._id.toString());
    return {
      user: publicUser(user),
      organization: {
        id: organization._id.toString(),
        name: organization.name,
      },
      role,
      ...tokens,
    };
  } catch (error) {
    await User.findByIdAndDelete(user._id);
    throw error;
  }
}

export async function login(input: LoginInput) {
  const user = await User.findOne({ email: input.email.toLowerCase() });
  if (!user || !(await verifyPassword(input.password, user.passwordHash))) {
    throw new AppError(401, 'INVALID_CREDENTIALS', 'Invalid email or password');
  }

  const membership = await Membership.findOne({
    userId: user._id,
    status: MembershipStatus.ACTIVE,
  }).sort({ createdAt: 1 });

  const organization = membership
    ? await Organization.findById(membership.organizationId)
    : null;

  await writeAuditLog({
    actorId: user._id,
    organizationId: membership?.organizationId ?? null,
    action: 'user.login',
    resourceType: 'user',
    resourceId: user._id.toString(),
  });

  const tokens = await issueSession(user._id.toString());
  return {
    user: publicUser(user),
    organization: organization
      ? { id: organization._id.toString(), name: organization.name }
      : null,
    role: membership?.role ?? null,
    ...tokens,
  };
}

export async function logout(userId: string) {
  await User.findByIdAndUpdate(userId, { refreshTokenHash: null });
  await writeAuditLog({
    actorId: userId,
    action: 'user.logout',
    resourceType: 'user',
    resourceId: userId,
  });
}

export async function refresh(refreshToken: string) {
  let payload;
  try {
    payload = verifyRefreshToken(refreshToken);
  } catch {
    throw new AppError(401, 'UNAUTHORIZED', 'Invalid or expired refresh token');
  }

  const user = await User.findById(payload.sub);
  if (!user?.refreshTokenHash) {
    throw new AppError(401, 'UNAUTHORIZED', 'Refresh token revoked');
  }

  const valid = await verifyTokenHash(refreshToken, user.refreshTokenHash);
  if (!valid) {
    throw new AppError(401, 'UNAUTHORIZED', 'Refresh token mismatch');
  }

  return issueSession(user._id.toString());
}

export async function getMe(userId: string) {
  const user = await User.findById(userId);
  if (!user) {
    throw new AppError(404, 'NOT_FOUND', 'User not found');
  }

  const memberships = await Membership.find({
    userId: user._id,
    status: MembershipStatus.ACTIVE,
  });

  const orgIds = memberships.map((m) => m.organizationId);
  const organizations = await Organization.find({ _id: { $in: orgIds } });
  const orgMap = new Map(organizations.map((o) => [o._id.toString(), o]));

  return {
    user: publicUser(user),
    memberships: memberships.map((m) => {
      const org = orgMap.get((m.organizationId as mongoose.Types.ObjectId).toString());
      return {
        id: m._id.toString(),
        role: m.role,
        organization: org
          ? { id: org._id.toString(), name: org.name }
          : null,
      };
    }),
  };
}

export async function verifyEmail(token: string) {
  const users = await User.find({
    emailVerificationTokenHash: { $ne: null },
    emailVerificationExpiresAt: { $gt: new Date() },
  });

  let matched = null;
  for (const user of users) {
    if (
      user.emailVerificationTokenHash &&
      (await verifyTokenHash(token, user.emailVerificationTokenHash))
    ) {
      matched = user;
      break;
    }
  }

  if (!matched) {
    throw new AppError(400, 'INVALID_TOKEN', 'Verification token is invalid or expired');
  }

  matched.emailVerified = true;
  matched.emailVerificationTokenHash = null;
  matched.emailVerificationExpiresAt = null;
  await matched.save();

  await writeAuditLog({
    actorId: matched._id,
    action: 'user.email_verified',
    resourceType: 'user',
    resourceId: matched._id.toString(),
  });

  return publicUser(matched);
}

export async function forgotPassword(email: string) {
  const user = await User.findOne({ email: email.toLowerCase() });
  // Always succeed to avoid account enumeration
  if (!user) {
    return { ok: true };
  }

  const token = createToken();
  user.passwordResetTokenHash = await hashToken(token);
  user.passwordResetExpiresAt = new Date(Date.now() + 60 * 60 * 1000);
  await user.save();

  try {
    await sendPasswordResetEmail(user.email, user.name, token);
  } catch (error) {
    console.error('Failed to send password reset email', error);
  }

  await writeAuditLog({
    actorId: user._id,
    action: 'user.forgot_password',
    resourceType: 'user',
    resourceId: user._id.toString(),
  });

  return { ok: true };
}

export async function resetPassword(token: string, password: string) {
  const users = await User.find({
    passwordResetTokenHash: { $ne: null },
    passwordResetExpiresAt: { $gt: new Date() },
  });

  let matched = null;
  for (const user of users) {
    if (
      user.passwordResetTokenHash &&
      (await verifyTokenHash(token, user.passwordResetTokenHash))
    ) {
      matched = user;
      break;
    }
  }

  if (!matched) {
    throw new AppError(400, 'INVALID_TOKEN', 'Reset token is invalid or expired');
  }

  matched.passwordHash = await hashPassword(password);
  matched.passwordResetTokenHash = null;
  matched.passwordResetExpiresAt = null;
  matched.refreshTokenHash = null;
  await matched.save();

  await writeAuditLog({
    actorId: matched._id,
    action: 'user.password_reset',
    resourceType: 'user',
    resourceId: matched._id.toString(),
  });

  return { ok: true };
}

export async function updateProfile(userId: string, name: string) {
  const user = await User.findByIdAndUpdate(
    userId,
    { name },
    { new: true },
  );
  if (!user) {
    throw new AppError(404, 'NOT_FOUND', 'User not found');
  }
  return publicUser(user);
}

export async function changePassword(
  userId: string,
  currentPassword: string,
  newPassword: string,
) {
  const user = await User.findById(userId);
  if (!user) {
    throw new AppError(404, 'NOT_FOUND', 'User not found');
  }

  if (!(await verifyPassword(currentPassword, user.passwordHash))) {
    throw new AppError(400, 'INVALID_PASSWORD', 'Current password is incorrect');
  }

  user.passwordHash = await hashPassword(newPassword);
  user.refreshTokenHash = null;
  await user.save();

  await writeAuditLog({
    actorId: user._id,
    action: 'user.password_changed',
    resourceType: 'user',
    resourceId: user._id.toString(),
  });

  return { ok: true };
}

export { issueSession };
