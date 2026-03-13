import { Resend } from "resend";
import { withRetry } from "./retry";

let _resend: Resend | null = null;
function getResend(): Resend {
  if (!_resend) {
    _resend = new Resend(process.env.RESEND_API_KEY);
  }
  return _resend;
}

function getFromAddress(): string {
  return process.env.RESEND_FROM_EMAIL || "onboarding@resend.dev";
}

export async function sendPasswordResetEmail(to: string, code: string) {
  const { data, error } = await withRetry(
    () => getResend().emails.send({
      from: `Measy MissCall <${getFromAddress()}>`,
      to,
      subject: "Your Password Reset Code",
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 480px; margin: 0 auto; padding: 32px;">
          <h2 style="color: #1a1a1a; margin-bottom: 8px;">Password Reset</h2>
          <p style="color: #555; font-size: 15px;">
            You requested a password reset for your Measy MissCall account.
            Use the code below to reset your password. It expires in 10 minutes.
          </p>
          <div style="background: #f4f4f5; border-radius: 8px; padding: 24px; text-align: center; margin: 24px 0;">
            <span style="font-size: 32px; font-weight: 700; letter-spacing: 6px; color: #1a1a1a;">${code}</span>
          </div>
          <p style="color: #888; font-size: 13px;">
            If you didn&apos;t request this, you can safely ignore this email.
          </p>
        </div>
      `,
    }),
    { label: "resend-password-reset" }
  );

  if (error) {
    console.error("Resend email error:", JSON.stringify(error));
    throw new Error(`Failed to send email: ${error.message}`);
  }

  console.log("Resend email sent:", JSON.stringify(data));
}

export async function sendStaffInviteEmail(
  to: string,
  staffName: string,
  businessName: string,
  inviteUrl: string
) {
  const { data, error } = await withRetry(
    () => getResend().emails.send({
      from: `Measy MissCall <${getFromAddress()}>`,
      to,
      subject: `You've been invited to join ${businessName}`,
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 480px; margin: 0 auto; padding: 32px;">
          <h2 style="color: #1a1a1a; margin-bottom: 8px;">Team Invitation</h2>
          <p style="color: #555; font-size: 15px;">
            Hi ${staffName}, you've been invited to join <strong>${businessName}</strong> on Measy MissCall as a team member.
          </p>
          <div style="text-align: center; margin: 32px 0;">
            <a href="${inviteUrl}" style="background: #2563eb; color: #fff; padding: 12px 32px; border-radius: 8px; text-decoration: none; font-weight: 600; font-size: 15px;">
              Accept Invitation
            </a>
          </div>
          <p style="color: #888; font-size: 13px;">
            This invitation expires in 7 days. If you didn't expect this, you can safely ignore this email.
          </p>
        </div>
      `,
    }),
    { label: "resend-staff-invite" }
  );

  if (error) {
    console.error("Staff invite email error:", JSON.stringify(error));
    throw new Error(`Failed to send invite email: ${error.message}`);
  }

  console.log("Staff invite email sent:", JSON.stringify(data));
}
