const User = require("../models/User");
const Role = require("../models/Role");
const PasswordReset = require("../models/PasswordReset");
const { sendEmail, LOGO_URL } = require("../utilities/sendEmail");
const { getSignature } = require("../utilities/emailSignature");
const crypto = require("crypto");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");

/**
 * Unified Login for all user types (HR, Employee, Intern, Manager)
 * Accepts: identifier (email/ID) + password
 */
exports.login = async (req, res) => {
  try {
    const { identifier, password } = req.body;
    if (!identifier || !password) {
      return res.status(400).json({ success: false, message: "Identifier and password are required" });
    }

    const id = identifier.trim();
    let user = null;
    let role = null;

    // ── 1. Models ──
    const Intern = require("../models/Intern");
    const Employee = require("../models/EmployeeModel");
    // User model is already imported at top

    // ── 2. Lookup ──
    console.log(`[LOGIN] Identifier: ${id}`);
    
    // Try Intern
    user = await Intern.findOne({
      $or: [
        { internid: { $regex: new RegExp(`^${id}$`, "i") } },
        { email:    { $regex: new RegExp(`^${id}$`, "i") } }
      ]
    });
    if (user) {
      role = user.isHr ? "hr" : "intern";
      console.log(`[LOGIN] Found in Intern collection. Role: ${role}`);
    }

    // Try Employee / Manager
    if (!user) {
      user = await Employee.findOne({
        $or: [
          { EmployeeId: { $regex: new RegExp(`^${id}$`, "i") } },
          { email:      { $regex: new RegExp(`^${id}$`, "i") } }
        ]
      });
      if (user) {
        role = user.isHr ? "hr" : (user.isManager ? "manager" : "employee");
        console.log(`[LOGIN] Found in Employee collection. Role: ${role}`);
      }
    }

    // Try HR (User)
    if (!user) {
      user = await User.findOne({
        $or: [
          { employeeId: { $regex: new RegExp(`^${id}$`, "i") } },
          { email:      { $regex: new RegExp(`^${id}$`, "i") } }
        ]
      }).select('+password').populate('roleId');
      
      if (user) {
        // Use the actual name from Role model if available, fallback to 'hr'
        role = user.roleId?.name?.toLowerCase() || "hr";
        console.log(`[LOGIN] Found in User collection. Role: ${role}`);
      }
    }

    if (!user) {
      return res.status(404).json({ success: false, message: "No account found with that ID or email" });
    }

    // ── 3. Password Verification ──
    let isMatch = false;
    if (!user.password || user.password === "") {
      const salt = await bcrypt.genSalt(10);
      user.password = await bcrypt.hash(password, salt);
      await user.save();
      isMatch = true;
    } else {
      const isHashed = user.password.startsWith("$2a$") || user.password.startsWith("$2b$");
      if (isHashed) {
        isMatch = await bcrypt.compare(password, user.password);
      } else {
        isMatch = user.password === password;
        if (isMatch) {
          const salt = await bcrypt.genSalt(10);
          user.password = await bcrypt.hash(password, salt);
          await user.save();
        }
      }
    }

    if (!isMatch) {
      return res.status(401).json({ success: false, message: "Incorrect password" });
    }

    // ── 4. Token Generation ──
    const tokenPayload = {
      user: {
        id: user._id,
        companyId: user.companyId,
        role: role === 'intern' ? 'employee' : role,
        roleName: role.toUpperCase()
      }
    };

    const token = jwt.sign(
      tokenPayload,
      process.env.JWT_SECRET || "fallback_secret_key",
      { expiresIn: "7d" }
    );

    const response = { 
      success: true,
      role, 
      token, 
      auth_token: token, 
      user 
    };

    // Web portal compatibility
    if (role === 'employee' || role === 'manager') {
      response.employee = user;
    }

    res.json(response);
  } catch (err) {
    console.error("Unified Login Error:", err);
    res.status(500).json({ success: false, message: "Server error", error: err.message });
  }
};

/**
 * Get current user profile
 */
exports.getMe = async (req, res) => {
  try {
    let role = "employee";

    // 1. Try User collection first
    let user = await User.findById(req.user.id).populate('roleId companyId departmentId branchId');
    if (user) {
      role = user.roleId?.name?.toLowerCase() || "hr";
    }
    
    // 2. If not found in User, try Employee (for managers/employees who logged in directly)
    if (!user) {
      const Employee = require("../models/EmployeeModel");
      user = await Employee.findById(req.user.id);
      if (user) {
        role = user.isHr ? "hr" : (user.isManager ? "manager" : "employee");
      }
    }
    
    // 3. If still not found, try Intern
    if (!user) {
      const Intern = require("../models/Intern");
      user = await Intern.findById(req.user.id);
      if (user) {
        role = user.isHr ? "hr" : "intern";
      }
    }

    if (!user) {
      return res.status(404).json({ success: false, message: 'User not found' });
    }

    res.status(200).json({ success: true, user, role });
  } catch (err) {
    console.error("getMe Error:", err);
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

/**
 * Publicly verify a company code and return basic settings
 */
exports.verifyCompany = async (req, res) => {
  try {
    const { code } = req.params;
    if (!code) {
      return res.status(400).json({ success: false, message: "Company code is required" });
    }

    const Company = require("../models/CompanyModel");
    const company = await Company.findOne({ companyCode: code.toUpperCase() });

    if (!company) {
      return res.status(404).json({ success: false, message: "Company not found" });
    }

    const companyObj = company.toObject();
    const settings = companyObj.settings || {};
    const employeeRoles = Array.from(new Set([...(settings.employeeRoles || []), 'Other']));
    const internRoles = Array.from(new Set([...(settings.internRoles || []), 'Other']));

    res.json({
      success: true,
      company: {
        id: company._id,
        name: company.name,
        logo: company.logo,
        settings: {
          themeColor: settings.themeColor || '#00657F',
          employeeRoles: employeeRoles,
          internRoles: internRoles
        }
      }
    });
  } catch (err) {
    console.error("Verify Company Error:", err);
    res.status(500).json({ success: false, message: "Server error" });
  }
};
