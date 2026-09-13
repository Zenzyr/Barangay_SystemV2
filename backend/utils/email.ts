import nodemailer from "nodemailer";

let transporter: nodemailer.Transporter | null = null;

function getTransporter(): nodemailer.Transporter | null {
  if (transporter) return transporter;

  const host = process.env.SMTP_HOST;
  const port = process.env.SMTP_PORT;
  const user = process.env.SMTP_USER;
  const pass = process.env.SMTP_PASS;

  if (!host || !port || !user || !pass) {
    console.warn(
      "[EMAIL] SMTP is not configured:",
      {
        host: !!host,
        port: !!port,
        user: !!user,
        pass: !!pass,
      }
    );
    return null;
  }

  transporter = nodemailer.createTransport({
    host,
    port: parseInt(port, 10),
    secure: parseInt(port, 10) === 465,
    auth: {
      user,
      pass,
    },
  });

  return transporter;
}

export const sendEmail = async (
  to: string,
  subject: string,
  html: string
): Promise<boolean> => {
  try {
    const t = getTransporter();

    if (!t) {
      console.error("[EMAIL] SMTP transporter could not be created");
      return false;
    }

    const from = process.env.SMTP_FROM || process.env.SMTP_USER;

    console.log("[EMAIL] Sending email...");
    console.log("[EMAIL] From:", from);
    console.log("[EMAIL] To:", to);
    console.log("[EMAIL] Subject:", subject);

    const info = await t.sendMail({
      from,
      to,
      subject,
      html,
    });

    console.log("[EMAIL] Email sent successfully");
    console.log("[EMAIL] Message ID:", info.messageId);
    console.log("[EMAIL] Accepted:", info.accepted);
    console.log("[EMAIL] Rejected:", info.rejected);
    console.log("[EMAIL] Response:", info.response);

    return true;
  } catch (error) {
    console.error("[EMAIL] Failed to send email:", error);
    return false;
  }
};