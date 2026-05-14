const hrModel = require("../models/hr_models");
const Company = require("../models/CompanyModel");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");

// HR Signup
exports.hrSignup = async (req, res) => {
  try {
    const { name, email, password, companyName, companyCode } = req.body;

    const existingUser = await hrModel.findOne({ email });
    if (existingUser) {
      return res.status(400).json({ msg: "Email already exists" });
    }

    let companyId = null;
    if (companyName && companyCode) {
      let company = await Company.findOne({ companyCode });
      if (company) {
        return res.status(400).json({ msg: "Company code already exists" });
      }
      company = new Company({ name: companyName, companyCode });
      await company.save();
      companyId = company._id;
    } else {
      return res.status(400).json({ msg: "Company name and code are required for signup" });
    }

    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash(password, salt);

    const newHR = new hrModel({ name, email, password: hashedPassword, companyId });
    await newHR.save();

    res.status(201).json({
      msg: "HR Registered Successfully",
      user: { _id: newHR._id, name: newHR.name, email: newHR.email, companyId: newHR.companyId }
    });
  } catch (err) {
    res.status(500).json({ msg: "Server error", error: err.message });
  }
};

// HR Login has been replaced by unified-login in auth.routes.js

// Save HR Policy URL
exports.savePolicyUrl = async (req, res) => {
  try {
    const { email, policyUrl } = req.body;

    if (!email || !policyUrl) {
      return res.status(400).json({ msg: "Email and policyUrl are required" });
    }

    const hrUser = await hrModel.findOneAndUpdate(
      { email },
      { 
        hr_policy_url: policyUrl,
        policy_updated_at: new Date()
      },
      { new: true }
    );

    if (!hrUser) {
      return res.status(404).json({ msg: "HR user not found" });
    }

    res.json({ 
      success: true,
      msg: "Policy URL saved successfully",
      policy_url: hrUser.hr_policy_url,
      policy_updated_at: hrUser.policy_updated_at
    });
  } catch (err) {
    res.status(500).json({ msg: "Server error", error: err.message });
  }
};

// Get HR Policy URL
exports.getPolicyUrl = async (req, res) => {
  try {
    const { email } = req.query;

    if (!email) {
      return res.status(400).json({ msg: "Email is required" });
    }

    const hrUser = await hrModel
      .findOne({ email })
      .select("hr_policy_url policy_updated_at");

    if (!hrUser) {
      return res.status(404).json({ msg: "HR user not found" });
    }

    res.json({ 
      success: true,
      policy_url: hrUser.hr_policy_url,
      policy_updated_at: hrUser.policy_updated_at
    });
  } catch (err) {
    res.status(500).json({ msg: "Server error", error: err.message });
  }
};

// Get HR Policy URL for Interns
exports.getPolicyForInterns = async (req, res) => {
  try {
    // Note: In multi-tenant, this should be scoped by companyId!
    const hrUser = await hrModel.findOne().select("hr_policy_url policy_updated_at");

    if (!hrUser || !hrUser.hr_policy_url) {
      return res.status(404).json({ success: false, msg: "No HR policy available" });
    }

    res.json({
      success: true,
      policy_url: hrUser.hr_policy_url.trim(),
      policy_updated_at: hrUser.policy_updated_at
    });
  } catch (err) {
    res.status(500).json({ success: false, msg: "Server error", error: err.message });
  }
};
