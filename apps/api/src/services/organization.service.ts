import { MembershipStatus, OrgRole, type InviteMemberInput } from '@cml/shared';
import mongoose from 'mongoose';
import { config } from '../config/index.js';
import { Invitation } from '../models/Invitation.js';
import { Membership } from '../models/Membership.js';
import { Organization } from '../models/Organization.js';
import { User } from '../models/User.js';
import { writeAuditLog } from '../repositories/audit.repository.js';
import { sendInvitationEmail } from '../utils/email.js';
import { AppError } from '../utils/errors.js';
import { createToken, hashToken, verifyTokenHash } from '../utils/tokens.js';

export async function getOrganization(organizationId: string) {
  const org = await Organization.findById(organizationId);
  if (!org) {
    throw new AppError(404, 'NOT_FOUND', 'Organization not found');
  }
  return {
    id: org._id.toString(),
    name: org.name,
    createdAt: (org as { createdAt?: Date }).createdAt,
    updatedAt: (org as { updatedAt?: Date }).updatedAt,
  };
}

export async function updateOrganization(organizationId: string, name: string, actorId: string) {
  const org = await Organization.findByIdAndUpdate(
    organizationId,
    { name },
    { new: true },
  );
  if (!org) {
    throw new AppError(404, 'NOT_FOUND', 'Organization not found');
  }

  await writeAuditLog({
    actorId,
    organizationId,
    action: 'organization.updated',
    resourceType: 'organization',
    resourceId: organizationId,
    metadata: { name },
  });

  return {
    id: org._id.toString(),
    name: org.name,
  };
}

export async function listMembers(organizationId: string) {
  const memberships = await Membership.find({
    organizationId,
    status: MembershipStatus.ACTIVE,
  });

  const userIds = memberships.map((m) => m.userId);
  const users = await User.find({ _id: { $in: userIds } });
  const userMap = new Map(users.map((u) => [u._id.toString(), u]));

  return memberships.map((m) => {
    const user = userMap.get((m.userId as mongoose.Types.ObjectId).toString());
    return {
      id: m._id.toString(),
      role: m.role,
      status: m.status,
      user: user
        ? {
            id: user._id.toString(),
            email: user.email,
            name: user.name,
          }
        : null,
      createdAt: (m as { createdAt?: Date }).createdAt,
    };
  });
}

export async function inviteMember(
  organizationId: string,
  actorId: string,
  input: InviteMemberInput,
) {
  const org = await Organization.findById(organizationId);
  if (!org) {
    throw new AppError(404, 'NOT_FOUND', 'Organization not found');
  }

  const email = input.email.toLowerCase();
  const existingUser = await User.findOne({ email });
  if (existingUser) {
    const existingMembership = await Membership.findOne({
      userId: existingUser._id,
      organizationId,
      status: MembershipStatus.ACTIVE,
    });
    if (existingMembership) {
      throw new AppError(409, 'ALREADY_MEMBER', 'User is already a member');
    }
  }

  const existingInvite = await Invitation.findOne({
    email,
    organizationId,
    acceptedAt: null,
    expiresAt: { $gt: new Date() },
  });
  if (existingInvite) {
    throw new AppError(409, 'INVITE_EXISTS', 'An active invitation already exists for this email');
  }

  const token = createToken();
  const tokenHash = await hashToken(token);
  const expiresAt = new Date(
    Date.now() + config.invitationExpiresDays * 24 * 60 * 60 * 1000,
  );

  const invitation = await Invitation.create({
    email,
    organizationId,
    role: input.role,
    tokenHash,
    expiresAt,
    invitedBy: actorId,
  });

  try {
    await sendInvitationEmail(email, org.name, token, input.role);
  } catch (error) {
    console.error('Failed to send invitation email', error);
  }

  await writeAuditLog({
    actorId,
    organizationId,
    action: 'organization.member_invited',
    resourceType: 'invitation',
    resourceId: invitation._id.toString(),
    metadata: { email, role: input.role },
  });

  return {
    id: invitation._id.toString(),
    email: invitation.email,
    role: invitation.role,
    expiresAt: invitation.expiresAt,
  };
}

export async function updateMemberRole(
  organizationId: string,
  memberId: string,
  role: OrgRole,
  actorId: string,
  actorMembershipId: string,
) {
  const membership = await Membership.findOne({
    _id: memberId,
    organizationId,
    status: MembershipStatus.ACTIVE,
  });
  if (!membership) {
    throw new AppError(404, 'NOT_FOUND', 'Member not found');
  }

  if (membership._id.toString() === actorMembershipId && role !== OrgRole.ADMIN) {
    const adminCount = await Membership.countDocuments({
      organizationId,
      status: MembershipStatus.ACTIVE,
      role: OrgRole.ADMIN,
    });
    if (adminCount <= 1) {
      throw new AppError(
        400,
        'LAST_ADMIN',
        'Cannot demote the last admin of the organization',
      );
    }
  }

  membership.role = role;
  await membership.save();

  await writeAuditLog({
    actorId,
    organizationId,
    action: 'organization.member_role_updated',
    resourceType: 'membership',
    resourceId: membership._id.toString(),
    metadata: { role },
  });

  return {
    id: membership._id.toString(),
    role: membership.role,
  };
}

export async function removeMember(
  organizationId: string,
  memberId: string,
  actorId: string,
  actorMembershipId: string,
) {
  const membership = await Membership.findOne({
    _id: memberId,
    organizationId,
    status: MembershipStatus.ACTIVE,
  });
  if (!membership) {
    throw new AppError(404, 'NOT_FOUND', 'Member not found');
  }

  if (membership._id.toString() === actorMembershipId) {
    throw new AppError(400, 'CANNOT_REMOVE_SELF', 'You cannot remove yourself');
  }

  if (membership.role === OrgRole.ADMIN) {
    const adminCount = await Membership.countDocuments({
      organizationId,
      status: MembershipStatus.ACTIVE,
      role: OrgRole.ADMIN,
    });
    if (adminCount <= 1) {
      throw new AppError(400, 'LAST_ADMIN', 'Cannot remove the last admin');
    }
  }

  membership.status = MembershipStatus.REMOVED;
  await membership.save();

  await writeAuditLog({
    actorId,
    organizationId,
    action: 'organization.member_removed',
    resourceType: 'membership',
    resourceId: membership._id.toString(),
  });

  return { ok: true };
}

async function findOpenInvitationByToken(token: string) {
  const invitations = await Invitation.find({
    acceptedAt: null,
    expiresAt: { $gt: new Date() },
  });

  for (const invite of invitations) {
    if (await verifyTokenHash(token, invite.tokenHash)) {
      return invite;
    }
  }

  throw new AppError(400, 'INVALID_INVITE', 'Invitation is invalid or expired');
}

export async function getInvitationPreview(token: string) {
  const matched = await findOpenInvitationByToken(token);
  const org = await Organization.findById(matched.organizationId);
  return {
    email: matched.email,
    role: matched.role,
    organization: org
      ? { id: org._id.toString(), name: org.name }
      : null,
    expiresAt: matched.expiresAt,
  };
}

export async function listPendingInvitations(organizationId: string) {
  const invitations = await Invitation.find({
    organizationId,
    acceptedAt: null,
    expiresAt: { $gt: new Date() },
  }).sort({ createdAt: -1 });

  return invitations.map((invite) => ({
    id: invite._id.toString(),
    email: invite.email,
    role: invite.role,
    expiresAt: invite.expiresAt,
  }));
}

export async function acceptInvitation(token: string, userId: string) {
  const matched = await findOpenInvitationByToken(token);
  const user = await User.findById(userId);
  if (!user) {
    throw new AppError(401, 'UNAUTHORIZED', 'User not found');
  }

  if (user.email.toLowerCase() !== matched.email.toLowerCase()) {
    throw new AppError(
      403,
      'INVITE_EMAIL_MISMATCH',
      `This invitation was sent to ${matched.email}. Sign in with that email to accept it.`,
    );
  }

  const organization = await Organization.findById(matched.organizationId);
  if (!organization) {
    throw new AppError(404, 'ORG_NOT_FOUND', 'Organization not found');
  }

  let membership = await Membership.findOne({
    userId: user._id,
    organizationId: organization._id,
  });

  if (membership && membership.status === MembershipStatus.ACTIVE) {
    matched.acceptedAt = new Date();
    await matched.save();
  } else if (membership) {
    membership.status = MembershipStatus.ACTIVE;
    membership.role = matched.role as OrgRole;
    await membership.save();
    matched.acceptedAt = new Date();
    await matched.save();
  } else {
    membership = await Membership.create({
      userId: user._id,
      organizationId: organization._id,
      role: matched.role,
      status: MembershipStatus.ACTIVE,
    });
    matched.acceptedAt = new Date();
    await matched.save();
  }

  await writeAuditLog({
    actorId: user._id,
    organizationId: organization._id,
    action: 'organization.invitation_accepted',
    resourceType: 'invitation',
    resourceId: matched._id.toString(),
    metadata: { email: user.email, role: matched.role },
  });

  return {
    organization: {
      id: organization._id.toString(),
      name: organization.name,
    },
    role: membership.role,
  };
}
