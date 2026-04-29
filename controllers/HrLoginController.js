const hrModel = require("../models/hr_models");

// HR Signup
exports.hrSignup = async (req, res) => {
  try {
    const { name, email, password } = req.body;

    const existingUser = await hrModel.findOne({ email });
    if (existingUser) {
      return res.status(400).json({ msg: "Email already exists" });
    }

    const newHR = new hrModel({ name, email, password });
    await newHR.save();

    res.status(201).json({
      msg: "HR Registered Successfully",
      user: newHR
    });
  } catch (err) {
    res.status(500).json({ msg: "Server error", error: err });
  }
};

// HR Login
exports.hrLogin = async (req, res) => {
  try {
    const { email, password } = req.body;

    const user = await hrModel.findOne({ email });
    if (!user) {
      return res.status(404).json({ msg: "User not found" });
    }

    if (user.password !== password) {
      return res.status(400).json({ msg: "Invalid password" });
    }

    res.status(200).json({
      msg: "Login successful",
      user
    });
  } catch (err) {
    res.status(500).json({ msg: "Server error", error: err });
  }
};

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
    const hrUser = await hrModel.findOne().select("hr_policy_url policy_updated_at");

    if (!hrUser || !hrUser.hr_policy_url) {
      return res.status(404).json({ success: false, msg: "No HR policy available" });
    }

    res.json({
      success: true,
      policy_url: hrUser.hr_policy_url.trim(), // trim newline
      policy_updated_at: hrUser.policy_updated_at
    });
  } catch (err) {
    res.status(500).json({ success: false, msg: "Server error", error: err.message });
  }
};

