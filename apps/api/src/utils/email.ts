import nodemailer from 'nodemailer';
import { config } from '../config/index.js';

const transporter = nodemailer.createTransport({
  host: config.smtp.host,
  port: config.smtp.port,
  secure: false,
});

export async function sendEmail(options: {
  to: string;
  subject: string;
  html: string;
  text: string;
}): Promise<void> {
  await transporter.sendMail({
    from: config.smtp.from,
    to: options.to,
    subject: options.subject,
    html: options.html,
    text: options.text,
  });
}

export async function sendVerificationEmail(
  to: string,
  name: string,
  token: string,
): Promise<void> {
  const url = `${config.clientUrl}/verify-email?token=${token}`;
  await sendEmail({
    to,
    subject: 'Verify your email — Contract Management',
    text: `Hi ${name},\n\nVerify your email: ${url}\n`,
    html: `<p>Hi ${name},</p><p><a href="${url}">Verify your email</a></p>`,
  });
}

export async function sendPasswordResetEmail(
  to: string,
  name: string,
  token: string,
): Promise<void> {
  const url = `${config.clientUrl}/reset-password?token=${token}`;
  await sendEmail({
    to,
    subject: 'Reset your password — Contract Management',
    text: `Hi ${name},\n\nReset your password: ${url}\n`,
    html: `<p>Hi ${name},</p><p><a href="${url}">Reset your password</a></p>`,
  });
}

export async function sendInvitationEmail(
  to: string,
  organizationName: string,
  token: string,
  role: string,
): Promise<void> {
  const url = `${config.clientUrl}/accept-invite?token=${token}`;
  await sendEmail({
    to,
    subject: `You're invited to ${organizationName}`,
    text: `You've been invited to join ${organizationName} as ${role}.\n\nAccept: ${url}\n`,
    html: `<p>You've been invited to join <strong>${organizationName}</strong> as <strong>${role}</strong>.</p><p><a href="${url}">Accept invitation</a></p>`,
  });
}
