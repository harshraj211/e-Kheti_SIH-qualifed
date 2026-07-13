import { betterAuth } from 'better-auth';
import { mongodbAdapter } from 'better-auth/adapters/mongodb';
import { Resend } from 'resend';
import { getDatabaseHandle } from '@/lib/mongodb';

const database = getDatabaseHandle();

const googleClientId = process.env.GOOGLE_CLIENT_ID;
const googleClientSecret = process.env.GOOGLE_CLIENT_SECRET;
const resend = process.env.RESEND_API_KEY ? new Resend(process.env.RESEND_API_KEY) : null;

export const auth = betterAuth({
  appName: 'eKheti',
  database: mongodbAdapter(database),
  emailAndPassword: {
    enabled: true,
    minPasswordLength: 8,
    maxPasswordLength: 128,
    resetPasswordTokenExpiresIn: 60 * 60,
    sendResetPassword: async ({ user, url }) => {
      if (!resend) {
        throw new Error('Password reset email is not configured.');
      }

      const { error } = await resend.emails.send({
        from: process.env.EMAIL_FROM || 'eKheti <onboarding@resend.dev>',
        to: user.email,
        subject: 'Reset your eKheti password',
        html: `
          <div style="font-family:Arial,sans-serif;max-width:560px;margin:auto;color:#1f2937">
            <h1 style="color:#257a36;font-size:24px">Reset your eKheti password</h1>
            <p>Hello ${escapeHtml(user.name || 'there')},</p>
            <p>We received a request to reset your password. This link expires in one hour.</p>
            <p style="margin:28px 0"><a href="${url}" style="background:#257a36;color:white;padding:12px 18px;text-decoration:none;border-radius:6px">Reset password</a></p>
            <p>If you did not request this, you can safely ignore this email.</p>
          </div>`,
      });

      if (error) throw new Error(error.message);
    },
  },
  socialProviders: googleClientId && googleClientSecret ? {
    google: {
      clientId: googleClientId,
      clientSecret: googleClientSecret,
    },
  } : undefined,
  trustedOrigins: [
    process.env.BETTER_AUTH_URL || 'http://localhost:9002',
    ...(process.env.VERCEL_URL ? [`https://${process.env.VERCEL_URL}`] : []),
  ],
});

function escapeHtml(value: string) {
  return value.replace(/[&<>'"]/g, character => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;',
  })[character] || character);
}
