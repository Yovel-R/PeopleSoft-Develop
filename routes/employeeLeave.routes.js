const express = require("express");
const router = express.Router();

const EmployeeLeave = require("../models/employeeLeave.model");
const LeaveCounter = require("../models/leaveCounter.model");
const Intern = require("../models/Intern");
const Employee = require("../models/EmployeeModel");
const Leave = require("../models/leave.model"); // legacy intern leaves

/* ============================
   APPLY LEAVE
============================ */
router.post("/apply", async (req, res) => {
  try {
    const data = req.body;

    const fromDate = new Date(data.fromDate);
    const toDate = new Date(data.toDate);

    const fromDay = new Date(Date.UTC(fromDate.getUTCFullYear(), fromDate.getUTCMonth(), fromDate.getUTCDate()));
    const toDay = new Date(Date.UTC(toDate.getUTCFullYear(), toDate.getUTCMonth(), toDate.getUTCDate()));

    // 1. Overlapping Leave Check
    const overlapping = await EmployeeLeave.find({
      employeeId: data.employeeId,
      hrStatus: { $ne: "rejected" },
      fromDate: { $lte: toDay },
      toDate: { $gte: fromDay },
    });

    if (overlapping.length > 0) {
      return res.status(400).json({ success: false, message: "You already have an overlapping leave." });
    }

    // 2. Fetch Assigned Manager
    let assignedManagerId = null;
    const intern = await Intern.findOne({ internid: data.employeeId });
    if (intern) {
      assignedManagerId = intern.assignedManager;
    } else {
      const employee = await Employee.findOne({ EmployeeId: data.employeeId });
      if (employee) assignedManagerId = employee.assignedManager;
    }

    // 3. Balance Check (Simplified)
    const isMaternityLeave = data.leaveType?.trim().toLowerCase() === "maternity leave";
    let normalizedLeaveType = data.leaveType;

    if (intern) {
      // Intern Limit: 2 days per month
      const monthStart = new Date(Date.UTC(fromDay.getUTCFullYear(), fromDay.getUTCMonth(), 1));
      const monthEnd = new Date(Date.UTC(fromDay.getUTCFullYear(), fromDay.getUTCMonth() + 1, 0, 23, 59, 59));
      const monthlyLeaves = await EmployeeLeave.find({
        employeeId: data.employeeId,
        hrStatus: { $ne: "rejected" },
        fromDate: { $gte: monthStart, $lte: monthEnd }
      });
      const usedThisMonth = monthlyLeaves.reduce((sum, l) => sum + (l.numberOfDays || 0), 0);
      if (usedThisMonth + Number(data.numberOfDays) > 2) {
        return res.status(400).json({ success: false, message: `Interns are allowed only 2 leaves per month. Used: ${usedThisMonth}` });
      }
    } else if (!isMaternityLeave) {
      const today = new Date();
      const counter = await LeaveCounter.findOne({
        employeeId: data.employeeId,
        leaveType: { $regex: `^${data.leaveType.trim()}$`, $options: "i" },
        cycleStartDate: { $lte: today },
        nextResetDate: { $gte: today },
      });

      if (!counter) return res.status(404).json({ success: false, message: "Leave balance not found" });
      if (Number(data.numberOfDays) > counter.balance) {
        return res.status(400).json({ success: false, message: `Insufficient balance. Available: ${counter.balance}` });
      }
      normalizedLeaveType = counter.leaveType;
    }

    // 4. Create Leave Request
    const leave = await EmployeeLeave.create({
      employeeId: data.employeeId,
      employeeName: data.employeeName,
      leaveType: normalizedLeaveType,
      fromDate: fromDay,
      toDate: toDay,
      numberOfDays: Number(data.numberOfDays),
      reason: data.reason,
      managerStatus: "pending",
      hrStatus: "pending",
      managerId: assignedManagerId ? assignedManagerId.toString() : null,
      rejectionReason: "",
      perDayDurations: data.perDayDurations || {},
    });

    res.json({ success: true, leaveId: leave._id });
  } catch (err) {
    console.error("Leave apply error:", err);
    res.status(500).json({ success: false, error: err.message });
  }
});

/* ============================
   MANAGER: GET TEAM LEAVE REQUESTS
============================ */
router.get("/manager-pending/:managerId", async (req, res) => {
  try {
    const leaves = await EmployeeLeave.find({ 
      managerId: req.params.managerId,
      managerStatus: "pending" 
    }).sort({ createdAt: -1 });
    res.json(leaves);
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

/* ============================
   MANAGER: APPROVE/REJECT LEAVE
============================ */
router.put("/manager-action/:leaveId", async (req, res) => {
  try {
    const { status, rejectionReason } = req.body; // status: accepted or rejected
    const leave = await EmployeeLeave.findById(req.params.leaveId);
    if (!leave) return res.status(404).json({ success: false, message: "Leave not found" });

    leave.managerStatus = status;
    if (status === "rejected") {
      leave.hrStatus = "rejected"; // If manager rejects, HR also sees it as rejected
      leave.rejectionReason = rejectionReason || "Rejected by Manager";
    }
    await leave.save();
    res.json({ success: true, message: `Leave ${status} by manager` });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

/* ============================
   HR: GET PENDING LEAVES (Only if Manager Approved)
============================ */
router.get("/hr-pending", async (req, res) => {
  try {
    const leaves = await EmployeeLeave.find({ 
      managerStatus: "accepted", 
      hrStatus: "pending" 
    }).sort({ createdAt: -1 });
    res.json(leaves);
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

/* ============================
   HR: FINAL APPROVE/REJECT
============================ */
router.put("/hr-action/:id", async (req, res) => {
  try {
    let { status, rejectionReason } = req.body;
    if (status === "approved") status = "accepted";

    const leave = await EmployeeLeave.findById(req.params.id);
    if (!leave) return res.status(404).json({ success: false, message: "Leave not found" });

    if (leave.managerStatus !== "accepted") {
      return res.status(400).json({ success: false, message: "Manager approval required first" });
    }

    // Process balance deduction if HR accepts
    if (status === "accepted") {
      // Check if it's an intern (they don't have LeaveCounters)
      const isIntern = await Intern.findOne({ internid: leave.employeeId });
      
      if (!isIntern) {
        const today = new Date();
        const counter = await LeaveCounter.findOne({
          employeeId: leave.employeeId,
          leaveType: { $regex: `^${leave.leaveType.trim()}$`, $options: "i" },
          cycleStartDate: { $lte: today },
          nextResetDate: { $gte: today },
        });

        if (!counter) return res.status(404).json({ success: false, message: "Leave balance not found" });

        const updatedCounter = await LeaveCounter.findOneAndUpdate(
          { _id: counter._id, balance: { $gte: leave.numberOfDays } },
          { $inc: { used: leave.numberOfDays, balance: -leave.numberOfDays } },
          { new: true }
        );

        if (!updatedCounter) return res.status(400).json({ success: false, message: "Insufficient leave balance" });
      }
    }

    leave.hrStatus = status;
    leave.rejectionReason = status === "rejected" ? rejectionReason || "" : "";
    await leave.save();

    res.json({ success: true, message: `Leave ${status} by HR`, leave });
  } catch (err) {
    console.error("HR Leave Action Error:", err);
    res.status(500).json({ success: false, message: "Server error", error: err.message });
  }
});

/* ============================
   COMMON GETTERS
============================ */
// Compatibility route for old frontend calls (e.g., GET /api/leave/:id)
router.get("/:employeeId", async (req, res) => {
  try {
    const leaves = await EmployeeLeave.find({ employeeId: req.params.employeeId }).sort({ fromDate: -1 });
    res.json(leaves);
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

router.get("/employee/:employeeId", async (req, res) => {
  try {
    const { employeeId } = req.params;
    
    // Fetch from both collections
    const [employeeLeaves, legacyLeaves] = await Promise.all([
      EmployeeLeave.find({ employeeId }).lean(),
      Leave.find({ internId: employeeId }).lean()
    ]);

    // Map legacy leaves to the new format if needed
    const normalizedLegacy = legacyLeaves.map(l => ({
      ...l,
      _id: l._id.toString(),
      employeeId: l.internId,
      employeeName: l.internName,
      managerStatus: l.managerStatus || l.status || "pending",
      hrStatus: l.hrStatus || l.status || "pending",
      isLegacy: true
    }));

    const combined = [...employeeLeaves, ...normalizedLegacy].sort((a, b) => {
      const dateA = a.fromDate instanceof Date ? a.fromDate : new Date(a.fromDate);
      const dateB = b.fromDate instanceof Date ? b.fromDate : new Date(b.fromDate);
      return dateB - dateA;
    });

    res.json(combined);
  } catch (err) {
    console.error("Fetch employee leaves error:", err);
    res.status(500).json({ success: false, error: err.message });
  }
});

router.get("/balance/:employeeId", async (req, res) => {
  try {
    const counters = await LeaveCounter.find({ employeeId: req.params.employeeId }).select("leaveType balance totalAllowed used").lean();
    res.json({ success: true, data: counters });
  } catch (err) {
    res.status(500).json({ success: false, message: "Server error" });
  }
});

router.get("/count/:employeeId", async (req, res) => {
  try {
    const { employeeId } = req.params;
    const month = parseInt(req.query.month);
    const year = parseInt(req.query.year);

    if (isNaN(month) || isNaN(year)) {
      return res.status(400).json({ success: false, message: "Month and Year are required." });
    }

    const startOfMonth = new Date(Date.UTC(year, month - 1, 1));
    const endOfMonth = new Date(Date.UTC(year, month, 0, 23, 59, 59, 999));

    const leaves = await EmployeeLeave.find({
      employeeId,
      hrStatus: { $ne: "rejected" },
      fromDate: { $gte: startOfMonth, $lte: endOfMonth }
    });

    const totalDays = leaves.reduce((sum, l) => sum + (l.numberOfDays || 0), 0);

    res.json({
      success: true,
      employeeId,
      month,
      year,
      totalDays,
      limit: 2
    });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

module.exports = router;
