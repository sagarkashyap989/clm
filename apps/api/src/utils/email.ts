import nodemailer from 'nodemailer';
import { config } from '../config/index.js';

const transporter = nodemailer.createTransport({
  host: config.smtp.host,
  port: config.smtp.port,
  secure: config.smtp.port === 465,
  auth:
    config.smtp.user && config.smtp.pass
      ? { user: config.smtp.user, pass: config.smtp.pass }
      : undefined,
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
