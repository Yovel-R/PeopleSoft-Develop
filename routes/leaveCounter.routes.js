const express = require("express");
const router = express.Router();
const LeaveCounter = require("../models/leaveCounter.model");

router.post("/init", async (req, res) => {
  const { employeeId, onboardingDate } = req.body;

  if (!employeeId || !onboardingDate) {
    return res.status(400).json({ message: "employeeId and onboardingDate required" });
  }

  const startDate = new Date(onboardingDate);
  const nextResetDate = new Date(startDate);
  nextResetDate.setFullYear(startDate.getFullYear() + 1);

  const leaveConfigs = [
    { type: "Casual Leave", days: 9 },
    { type: "Sick Leave", days: 12 },
    { type: "Bereavement Leave", days: 3 }
  ];

  const records = leaveConfigs.map(l => ({
    employeeId,
    leaveType: l.type,
    totalAllowed: l.days,
    used: 0,
    balance: l.days,
    cycleStartDate: startDate,
    nextResetDate
  }));

  try {
    await LeaveCounter.insertMany(records, { ordered: false });
    res.json({ message: "Leave counters initialized" });
  } catch (err) {
    // Ignore duplicate insert attempts (idempotent)
    res.json({ message: "Leave counters already exist" });
  }
});

module.exports = router;
