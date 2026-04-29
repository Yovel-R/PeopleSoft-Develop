const Intern = require("../models/Intern");

// Add Intern
exports.addIntern = async (req, res) => {
  try {
    const {
      fullName,
      college,
      year,
      department,
      role,
      email,
      contact,
      emergencyContact,
      onboardingDate,
      endDate,
      linkedin,
    } = req.body;

    const intern = new Intern({
      internid: "", 
      fullName,
      college,
      year,
      department,
      role,
      email,
      contact,
      emergencyContact,
      onboardingDate: "",
      endDate: "",
      linkedin,
      status: "initial", // auto-field
      password: "",
    });

    await intern.save();

    res.status(200).json({
      message: "Intern stored successfully",
      intern,
    });
  } catch (err) {
    console.error("Save Error:", err);
    res.status(500).json({ message: "Server error", error: err.message });
  }
};
