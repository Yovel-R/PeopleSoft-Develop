const Intern = require("../models/Intern");
const Employee = require("../models/EmployeeModel");
const HrUser = require("../models/hr_models");
const PasswordReset = require("../models/PasswordReset");
const { sendEmail, LOGO_URL } = require("../utilities/sendEmail");
const { getSignature } = require("../utilities/emailSignature");
const crypto = require("crypto");

exports.forgotPassword = async (req, res) => {
  try {
    const { email } = req.body;
    if (!email) {
      return res.status(400).json({ success: false, message: "Email is required" });
    }

    // Search in all three collections to find the user
    let user = await Intern.findOne({ email });
    let userType = 'intern';
    let name = '';

    if (!user) {
      user = await Employee.findOne({ email });
      userType = 'employee';
    }

    if (!user) {
      user = await HrUser.findOne({ email });
      userType = 'hr';
    }

    if (!user) {
      return res.status(404).json({ 
        success: false, 
        message: "No user exists with this email address." 
      });
    }

    name = (user.fullName || user.name || '')
      .split(" ")
      .map((word) => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
      .join(" ");

    // Generate token valid for 5 mins
    const token = crypto.randomBytes(32).toString('hex');
    const expiresAt = new Date(Date.now() + 5 * 60 * 1000); // 5 minutes

    // Clean up old tokens for this email
    await PasswordReset.deleteMany({ email });

    await PasswordReset.create({
      email,
      userType,
      token,
      expiresAt
    });

    // Determine the base URL for the reset link
    // Note: Since this is a hybrid Flutter/Node app, we'll host the reset page on the Node server
    const protocol = req.headers['x-forwarded-proto'] || req.protocol;
    const host = req.get('host');
    const resetLink = `${protocol}://${host}/reset-password.html?token=${token}`;

    await sendEmail({
      to: email,
      subject: "Password Reset Request – Softrate Global",
      html: `
        <div style="font-family: sans-serif; line-height: 1.6; color: #333;">
          <p>Dear ${name},</p>
          <p>We received a request to reset your password for your Softrate Global account.</p>
          <p>Please click the link below to set a new password. This link is valid for 5 minutes only:</p>
          <p><a href="${resetLink}" style="display: inline-block; padding: 10px 20px; background-color: #0089d1; color: #fff; text-decoration: none; border-radius: 5px;">Reset Password</a></p>
          <p>Or copy and paste this link into your browser:</p>
          <p>${resetLink}</p>
          <p>If you did not request a password reset, you can safely ignore this email.</p>
          ${getSignature(LOGO_URL)}
        </div>
      `
    });

    res.status(200).json({ 
      success: true, 
      message: "Reset link has been sent to your email." 
    });

  } catch (err) {
    console.error("Forgot Password Error:", err);
    res.status(500).json({ success: false, message: "Server error", error: err.message });
  }
};

exports.resetPassword = async (req, res) => {
  try {
    const { token, newPassword } = req.body;
    if (!token || !newPassword) {
      return res.status(400).json({ success: false, message: "Token and new password are required" });
    }

    const resetRequest = await PasswordReset.findOne({ token });
    if (!resetRequest) {
      return res.status(400).json({ success: false, message: "Invalid or expired reset link." });
    }

    if (new Date() > resetRequest.expiresAt) {
      await PasswordReset.deleteOne({ token });
      return res.status(400).json({ success: false, message: "Reset link has expired." });
    }

    // Find user by email and userType
    let userModel;
    if (resetRequest.userType === 'intern') userModel = Intern;
    else if (resetRequest.userType === 'employee') userModel = Employee;
    else if (resetRequest.userType === 'hr') userModel = HrUser;

    const user = await userModel.findOne({ email: resetRequest.email });
    if (!user) {
      return res.status(404).json({ success: false, message: "User account not found." });
    }

    // Update password (preserving current plain-text storage pattern)
    user.password = newPassword;
    await user.save();

    // Invalidate the token
    await PasswordReset.deleteOne({ token });

    res.status(200).json({ 
      success: true, 
      message: "Password reset successful! You can now log in with your new password." 
    });

  } catch (err) {
    console.error("Reset Password Error:", err);
    res.status(500).json({ success: false, message: "Server error", error: err.message });
  }
};
