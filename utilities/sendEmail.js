const { Resend } = require("resend");

// Logo hosted as a static asset — served via express.static('public')
const LOGO_URL = `${process.env.BACKEND_URL}/assets/images/softrate-logo.jpg`;

const sendEmail = async ({ to, subject, html, text, attachments = [] }) => {
  try {
    const resend = new Resend(process.env.RESEND_API_KEY);
    const fromEmail = process.env.FROM_EMAIL || "onboarding@resend.dev";

    const emailConfig = {
      from: `"PeopleSoft" <${fromEmail}>`,
      to,
      subject,
      replyTo: process.env.RECIVER_EMAIL_USER,
    };

    if (html) emailConfig.html = html;

    if (text) {
      emailConfig.text = text;
    } else if (html) {
      emailConfig.text = html.replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim();
    }

    if (attachments.length > 0) {
      emailConfig.attachments = attachments;
    }

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

module.exports = { sendEmail, LOGO_URL };