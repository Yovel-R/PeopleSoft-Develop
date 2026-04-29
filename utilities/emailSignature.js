const getSignature = (logoUrl = '') => {
  try {
    return `
      <div style="margin-top: 30px; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; font-size: 14px; color: #333; line-height: 1.5;">
        <p style="margin: 0;">Do follow us on <a href="https://www.instagram.com/softrate" style="color: #007bb6; text-decoration: underline;">Instagram</a> and <a href="https://linkedin.com/company/softrate" style="color: #007bb6; text-decoration: underline;">LinkedIn</a> to stay updated on future opportunities!</p>
        <p style="margin: 12px 0 24px 0;">Wishing you the best on your journey ahead!</p>
        <p style="margin: 0;">Cheers,</p>
        <p style="margin: 0 0 15px 0; font-weight: 500;">Early Careers Team</p>
        <a href="https://www.softrateglobal.com/" style="text-decoration: none; display: inline-block; height: 46px; overflow: hidden;">
          <img src="${logoUrl}" alt="Softrate Logo" width="145" style="display: block; border: 0; pointer-events: none; margin-top: -2px;">
        </a>
      </div>
    `;
  } catch (error) {
    console.error("Signature Error:", error);
    return "<p>Regards,<br>HR Team<br>Softrate Global</p>";
  }
};

module.exports = { getSignature };