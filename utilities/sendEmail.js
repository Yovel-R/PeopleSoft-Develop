const { Resend } = require("resend");

// Logo hosted as a static asset — served via express.static('public')
const getLogoUrl = () => {
  const baseUrl = process.env.BACKEND_URL || "http://localhost:5001";
  return `${baseUrl.replace(/\/$/, '')}/assets/images/softrate-logo.jpg`;
};

const sendEmail = async ({ to, subject, html, text, attachments = [], replyTo }) => {
  const LOGO_URL = getLogoUrl();
  console.log("Using Logo URL for email:", LOGO_URL);
  try {
    if (!process.env.RESEND_API_KEY) {
      throw new Error("RESEND_API_KEY is not defined in environment variables");
    }
    const resend = new Resend(process.env.RESEND_API_KEY);
    const fromEmail = process.env.FROM_EMAIL || "onboarding@resend.dev";

    const totalSize = attachments.reduce((acc, curr) => acc + (curr.content ? curr.content.length : 0), 0);
    console.log(`Total attachment size: ${(totalSize / 1024 / 1024).toFixed(2)} MB`);

    if (totalSize > 10 * 1024 * 1024) {
      throw new Error("Total attachment size exceeds 10MB limit (Resend limitation)");
    }

    if (!to) {
      throw new Error("Recipient email (to) is not defined");
    }

    const emailConfig = {
      from: `"PeopleSoft" <${fromEmail}>`,
      to,
      subject,
      replyTo: replyTo || process.env.RECIVER_EMAIL_USER,
    };

    if (html) emailConfig.html = html;

    if (text) {
      emailConfig.text = text;
    } else if (html) {
      emailConfig.text = html.replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim();
    }

    if (attachments.length > 0) {
      emailConfig.attachments = attachments.map(a => ({
        filename: a.filename,
        content: a.content.toString('base64'),
        contentType: a.contentType || 'application/pdf'
      }));
    }

    console.log("Sending email with config (attachments converted to base64):", {
      ...emailConfig,
      attachments: emailConfig.attachments.map(a => ({ filename: a.filename, base64Length: a.content.length }))
    });

    const { data, error } = await resend.emails.send(emailConfig);

    if (error) {
      console.error("✖ Resend API returned error:", error);
      throw new Error(error.message);
    }

    console.log("✔ Email Sent Successfully (via Resend)", data);
  } catch (error) {
    console.error("✖ Email Error:", error.message);
    throw error;
  }
};

module.exports = { sendEmail, getLogoUrl };