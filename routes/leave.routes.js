const express = require("express");
const router = express.Router();
const Leave = require("../models/leave.model");
const Intern = require("../models/Intern");

router.post("/apply", async (req, res) => {
  try {
    const data = req.body;

    const internId = data.internId;
    const fromDate = new Date(data.fromDate);
    const toDate   = new Date(data.toDate);

    const fromDay = new Date(fromDate.getFullYear(), fromDate.getMonth(), fromDate.getDate());
    const toDay   = new Date(toDate.getFullYear(),   toDate.getMonth(),   toDate.getDate());

    const numberOfDays = Number(data.numberOfDays);

    // 1. Intern Leave Limit Logic (Enforce 2 days per month)
    const intern = await Intern.findOne({ internid: internId });
    if (intern) {
      const year = fromDay.getFullYear();
      const month = fromDay.getMonth(); // 0-indexed

      // Start and end of the target month
      const startOfMonth = new Date(year, month, 1);
      const endOfMonth = new Date(year, month + 1, 0, 23, 59, 59, 999);

      // Query all non-rejected leaves for this intern in the same month
      const existingLeaves = await Leave.find({
        internId,
        status: { $ne: "rejected" },
        fromDate: { $gte: startOfMonth, $lte: endOfMonth }
      });

      const usedDays = existingLeaves.reduce((sum, l) => sum + (l.numberOfDays || 0), 0);

      if (usedDays + numberOfDays > 2) {
        return res.status(400).json({
          success: false,
          message: `Interns are allowed only 2 leaves per month. You have already used/applied for ${usedDays} day(s) this month.`,
        });
      }

      // Note: We no longer need to update intern.leaveCount as we query the Leave collection directly.
      // However, for backward compatibility or UI display, we could still update it, 
      // but it's cleaner to let the calculation be dynamic.
    }

    console.log("APPLY request:", {
      internId,
      fromDate: data.fromDate,
      toDate: data.toDate,
      fromDay,
      toDay,
    });

    const overlapping = await Leave.find({
      internId,
      status: { $ne: "rejected" },
      fromDate: { $lte: toDay },
      toDate:   { $gte: fromDay },
    });

    if (overlapping.length > 0) {
      return res.status(400).json({
        success: false,
        message: "You already have a leave request that overlaps these dates.",
      });
    }

    const leave = new Leave({
      internId,
      internName: data.internName,
      leaveType: data.leaveType,
      fromDate: fromDay,
      toDate: toDay,
      numberOfDays: numberOfDays,
      reason: data.reason,
      status: "pending",
      rejectionReason: "",
      perDayDurations: data.perDayDurations,
    });

    await leave.save();

    res.status(200).json({
      success: true,
      message: "Leave applied successfully",
      leaveId: leave._id,
    });

  } catch (err) {
    console.error("Leave apply error:", err);
    res.status(500).json({ success: false, error: err.message });
  }
});


router.get("/pending", async (req, res) => {
  try {
    // Find all leaves where status is 'pending'
    const pendingLeaves = await Leave.find({ status: "pending" });

    res.status(200).json(pendingLeaves);
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

router.put("/:id", async (req, res) => {
  try {
    const { status, rejectionReason } = req.body;
    const leave = await Leave.findById(req.params.id);
    if (!leave) return res.status(404).json({ success: false, message: "Leave not found" });

    leave.status = status;
    if (status === "rejected") {
      leave.rejectionReason = rejectionReason || "";
    }

    await leave.save();
    res.status(200).json({ success: true, leave });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});
// GET /api/leave/count/:internId?month=3&year=2026
router.get("/count/:internId", async (req, res) => {
  try {
    const { internId } = req.params;
    const month = parseInt(req.query.month); // 1-12
    const year = parseInt(req.query.year);

    if (isNaN(month) || isNaN(year)) {
      return res.status(400).json({ success: false, message: "Month and Year are required." });
    }

    const startOfMonth = new Date(year, month - 1, 1);
    const endOfMonth = new Date(year, month, 0, 23, 59, 59, 999);

    const leaves = await Leave.find({
      internId,
      status: { $ne: "rejected" },
      fromDate: { $gte: startOfMonth, $lte: endOfMonth }
    });

    const totalDays = leaves.reduce((sum, l) => sum + (l.numberOfDays || 0), 0);

    res.status(200).json({
      success: true,
      internId,
      month,
      year,
      totalDays,
      limit: 2
    });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// GET /api/leave/:internId
router.get("/:internId", async (req, res) => {
  try {
    const internId = req.params.internId;
    const leaves = await Leave.find({ internId }); // filter by internId
    res.status(200).json(leaves);
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});


// GET /api/intern/pastout?year=2025&month=0
// Returns interns with status "drop" filtered by year and (optionally) month of endDate.
router.get("/pastout", async (req, res) => {
  try {
    const year = parseInt(req.query.year, 10);
    const month = parseInt(req.query.month ?? "0", 10); // 0 = all months

    if (isNaN(year)) {
      return res
        .status(400)
        .json({ message: "year query param is required, e.g. ?year=2025&month=0" });
    }

    // base: only drop/past-out interns
    const dropped = await Intern.find({ status: "drop" }).sort({ endDate: -1 });

    // endDate is saved as "dd-MM-yyyy", so filter in JS
    const filtered = dropped.filter((intern) => {
      const raw = intern.endDate;
      if (!raw || typeof raw !== "string") return false;

      const parts = raw.split("-");
      if (parts.length !== 3) return false;

      const d = parseInt(parts[0], 10);
      const m = parseInt(parts[1], 10); // 1–12
      const y = parseInt(parts[2], 10);

      if (isNaN(d) || isNaN(m) || isNaN(y)) return false;
      if (y !== year) return false;
      if (month === 0) return true;

      return m === month;
    });

    return res.status(200).json(filtered);
  } catch (err) {
    console.error("Fetch Past-out Interns Error:", err);
    res
      .status(500)
      .json({ message: "Server error", error: err.message });
  }
});


module.exports = router;
