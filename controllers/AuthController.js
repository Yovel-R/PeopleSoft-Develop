const User = require("../models/User");
const Role = require("../models/Role");
const PasswordReset = require("../models/PasswordReset");
const { sendEmail, LOGO_URL } = require("../utilities/sendEmail");
const { getSignature } = require("../utilities/emailSignature");
const crypto = require("crypto");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");

/**
 * Unified Login for all user types (HR, Employee, Intern)
 */
exports.login = async (req, res) => {
  try {
    const { email, employeeId, password } = req.body;
    const loginIdentifier = email || employeeId;

    if (!loginIdentifier || !password) {
      return res.status(400).json({ success: false, message: 'Please provide email/ID and password' });
    }

    // 1. Find user in the unified collection (search by email OR employeeId)
    const user = await User.findOne({
      $or: [
        { email: loginIdentifier.toLowerCase() },
        { employeeId: loginIdentifier }
      ]
    }).select('+password').populate('roleId');
    
    if (!user) {
      return res.status(401).json({ success: false, message: 'Invalid credentials' });
    }

    // 2. Check if user is active
    if (user.employment.status === 'TERMINATED' || user.employment.status === 'SUSPENDED') {
      return res.status(403).json({ success: false, message: 'Account is inactive. Please contact support.' });
    }

    // 3. Verify Password (handle First Login or legacy)
    let isMatch = false;

    // A. Handle First Login (Onboarding phase with no password set)
    if (!user.password || user.password === "") {
      if (user.employment.status === 'ONBOARDING' || user.employment.status === 'ACTIVE') {
        const salt = await bcrypt.genSalt(10);
        user.password = await bcrypt.hash(password, salt);
        await user.save();
        isMatch = true;
      } else {
        return res.status(401).json({ success: false, message: 'Account not set up. Please contact HR.' });
      }
    } 
    // B. Handle normal bcrypt passwords
    else if (user.password.length === 60 || user.password.startsWith('$2a$') || user.password.startsWith('$2b$')) {
      isMatch = await bcrypt.compare(password, user.password);
    } 
    // C. Handle legacy plain-text passwords
    else {
      isMatch = (user.password === password);
      if (isMatch) {
        const salt = await bcrypt.genSalt(10);
        user.password = await bcrypt.hash(password, salt);
        await user.save();
      }
    }

    if (!isMatch) {
      return res.status(401).json({ success: false, message: 'Invalid credentials' });
    }

    // 4. Generate Token with expanded payload
    const roleName = user.roleId ? user.roleId.name : 'EMPLOYEE';
    
    // Maintain legacy 'role' field for frontend compatibility for now
    const legacyRole = (roleName === 'HR_ADMIN') ? 'hr' : 'employee';

    const payload = {
      user: {
        id: user._id,
        companyId: user.companyId,
        role: legacyRole,
        roleName: roleName,
        permissions: user.roleId ? user.roleId.permissions : []
      }
    };

    const token = jwt.sign(
      payload,
      process.env.JWT_SECRET || 'fallback_secret_key',
      { expiresIn: '1d' }
    );

    res.status(200).json({
      success: true,
      message: 'Login successful',
      token: token,
      auth_token: token,
      user: {
        id: user._id,
        email: user.email,
        name: user.profile.firstName + (user.profile.lastName ? ' ' + user.profile.lastName : ''),
        companyId: user.companyId,
        role: legacyRole,
        roleName: roleName
      }
    });

  } catch (err) {
    console.error('Login Error:', err);
    res.status(500).json({ success: false, message: 'Server error', error: err.message });
  }
};

/**
 * Get current user profile
 */
exports.getMe = async (req, res) => {
  try {
    const user = await User.findById(req.user.id).populate('roleId companyId departmentId branchId');
    if (!user) {
      return res.status(404).json({ success: false, message: 'User not found' });
    }
    res.status(200).json({ success: true, user });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Server error' });
  }
};

exports.forgotPassword = async (req, res) => {
  try {
    const { email } = req.body;
    if (!email) {
      return res.status(400).json({ success: false, message: "Email is required" });
    }

    // Search in unified User collection
    const user = await User.findOne({ email: email.toLowerCase() });

    if (!user) {
      return res.status(404).json({ 
        success: false, 
        message: "No user exists with this email address." 
      });
    }

    const name = (user.profile.firstName + (user.profile.lastName ? ' ' + user.profile.lastName : ''))
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
      userType: 'unified', // Marking as unified for future proofing
      token,
      expiresAt
    });

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

    const user = await User.findOne({ email: resetRequest.email });
    if (!user) {
      return res.status(404).json({ success: false, message: "User account not found." });
    }

    // Hash the new password
    const salt = await bcrypt.genSalt(10);
    user.password = await bcrypt.hash(newPassword, salt);
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
