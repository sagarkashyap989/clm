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
