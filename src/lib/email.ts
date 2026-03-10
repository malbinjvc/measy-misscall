import { Resend } from "resend";

const resend = new Resend(process.env.RESEND_API_KEY);

const FROM_ADDRESS = process.env.RESEND_FROM_EMAIL || "onboarding@resend.dev";

export async function sendPasswordResetEmail(to: string, code: string) {
  const { data, error } = await resend.emails.send({
    from: `Measy MissCall <${FROM_ADDRESS}>`,
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
  });

  if (error) {
    console.error("Resend email error:", JSON.stringify(error));
    throw new Error(`Failed to send email: ${error.message}`);
  }

  console.log("Resend email sent:", JSON.stringify(data));
}
