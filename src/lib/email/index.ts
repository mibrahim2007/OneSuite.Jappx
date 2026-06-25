import { Resend } from 'resend'

const resend = new Resend(process.env.RESEND_API_KEY)

export async function sendInvitationEmail(
  to: string,
  inviteUrl: string,
  invitedByName: string,
  roleName: string,
  orgName: string,
): Promise<void> {
  await resend.emails.send({
    from: process.env.EMAIL_FROM!,
    to: [to],
    subject: `You've been invited to join ${orgName} on OneSuite`,
    html: `
      <div style="font-family:sans-serif;max-width:480px;margin:0 auto;">
        <h2 style="margin-bottom:8px;">You've been invited to OneSuite</h2>
        <p style="color:#374151;margin-bottom:8px;">
          <strong>${invitedByName}</strong> has invited you to join <strong>${orgName}</strong>
          as <strong>${roleName}</strong>.
        </p>
        <p style="color:#374151;margin-bottom:24px;">
          Click the button below to accept your invitation and set up your account.
        </p>
        <a href="${inviteUrl}"
           style="display:inline-block;background:#0f172a;color:#fff;padding:12px 24px;border-radius:6px;text-decoration:none;font-weight:600;font-size:14px;">
          Accept invitation
        </a>
        <p style="color:#6b7280;font-size:13px;margin-top:32px;">
          This link expires in <strong>48 hours</strong>. If you didn't expect this invitation,
          you can safely ignore this email.
        </p>
      </div>
    `,
  })
}

export async function sendPasswordResetEmail(
  to: string,
  resetUrl: string
): Promise<void> {
  await resend.emails.send({
    from: process.env.EMAIL_FROM!,
    to: [to],
    subject: 'Reset your OneSuite password',
    html: `
      <div style="font-family:sans-serif;max-width:480px;margin:0 auto;">
        <h2 style="margin-bottom:8px;">Reset your password</h2>
        <p style="color:#374151;margin-bottom:24px;">
          Click the button below to set a new password. This link expires in <strong>1 hour</strong>.
        </p>
        <a href="${resetUrl}"
           style="display:inline-block;background:#0f172a;color:#fff;padding:12px 24px;border-radius:6px;text-decoration:none;font-weight:600;font-size:14px;">
          Reset my password
        </a>
        <p style="color:#6b7280;font-size:13px;margin-top:32px;">
          If you didn't request this, you can safely ignore this email.
          Your password won't change until you click the link above.
        </p>
      </div>
    `,
  })
}
