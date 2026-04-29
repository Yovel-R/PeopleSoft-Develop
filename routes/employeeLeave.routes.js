const express = require("express");
const router = express.Router();

const EmployeeLeave = require("../models/employeeLeave.model");
const LeaveCounter = require("../models/leaveCounter.model");

/* ============================
   APPLY LEAVE
============================ */
// router.post("/apply", async (req, res) => {
//   try {
//     const data = req.body;

//     const fromDate = new Date(data.fromDate);
//     const toDate = new Date(data.toDate);

//     const fromDay = new Date(fromDate.getFullYear(), fromDate.getMonth(), fromDate.getDate());
//     const toDay = new Date(toDate.getFullYear(), toDate.getMonth(), toDate.getDate());

//     // 1️⃣ OVERLAPPING LEAVE CHECK
//     const overlapping = await EmployeeLeave.find({
//       employeeId: data.employeeId,
//       status: { $ne: "rejected" },
//       fromDate: { $lte: toDay },
//       toDate: { $gte: fromDay },
//     });

//     if (overlapping.length > 0) {
//       return res.status(400).json({
//         success: false,
//         message: "You already have an overlapping leave.",
//       });
//     }

//     // 2️⃣ FETCH LEAVE COUNTER (BALANCE)
//     const counter = await LeaveCounter.findOne({
//       employeeId: data.employeeId,
//       leaveType: data.leaveType,
//     });

//     if (!counter) {
//       return res.status(404).json({
//         success: false,
//         message: "Leave balance not found",
//       });
//     }

//     // 3️⃣ ✅ INSUFFICIENT LEAVE BALANCE CHECK
//     if (Number(data.numberOfDays) > counter.balance) {
//       return res.status(400).json({
//         success: false,
//         message: "Insufficient leave balance",
//       });
//     }

//     // 4️⃣ CREATE LEAVE (NO DEDUCTION HERE)
//     const leave = await EmployeeLeave.create({
//       employeeId: data.employeeId,
//       employeeName: data.employeeName,
//       leaveType: data.leaveType,
//       fromDate: fromDay,
//       toDate: toDay,
//       numberOfDays: Number(data.numberOfDays),
//       reason: data.reason,
//       status: "pending",
//       rejectionReason: "",
//       perDayDurations: data.perDayDurations || {},
//     });

//     res.json({ success: true, leaveId: leave._id });
//   } catch (err) {
//     console.error("Leave apply error:", err);
//     res.status(500).json({ success: false, error: err.message });
//   }
// });
router.post("/apply", async (req, res) => {
  try {
    const data = req.body;

    const fromDate = new Date(data.fromDate);
    const toDate = new Date(data.toDate);

    const fromDay = new Date(fromDate.getFullYear(), fromDate.getMonth(), fromDate.getDate());
    const toDay = new Date(toDate.getFullYear(), toDate.getMonth(), toDate.getDate());

    /* ============================
       OVERLAPPING LEAVE CHECK
    ============================ */
    const overlapping = await EmployeeLeave.find({
      employeeId: data.employeeId,
      status: { $ne: "rejected" },
      fromDate: { $lte: toDay },
      toDate: { $gte: fromDay },
    });

    if (overlapping.length > 0) {
      return res.status(400).json({
        success: false,
        message: "You already have an overlapping leave.",
      });
    }

    /* ============================
       MATERNITY LEAVE (NO BALANCE CHECK)
    ============================ */
    const isMaternityLeave =
      data.leaveType?.trim().toLowerCase() === "maternity leave";

    let normalizedLeaveType = data.leaveType;

    if (!isMaternityLeave) {
      /* ============================
         FETCH CURRENT CYCLE COUNTER
      ============================ */
      const today = new Date();

      const counter = await LeaveCounter.findOne({
        employeeId: data.employeeId,
        leaveType: { $regex: `^${data.leaveType.trim()}$`, $options: "i" },
        cycleStartDate: { $lte: today },
        nextResetDate: { $gte: today },
      });

      if (!counter) {
        return res.status(404).json({
          success: false,
          message: "Leave balance not found",
        });
      }

      /* ============================
         ❌ BLOCK APPLY IF INSUFFICIENT
      ============================ */
      if (Number(data.numberOfDays) > counter.balance) {
        return res.status(400).json({
          success: false,
          message: `Insufficient leave balance. Available: ${counter.balance}`,
        });
      }

      normalizedLeaveType = counter.leaveType; // normalized
    }

    /* ============================
       CREATE LEAVE (NO DEDUCTION)
    ============================ */
    const leave = await EmployeeLeave.create({
      employeeId: data.employeeId,
      employeeName: data.employeeName,
      leaveType: normalizedLeaveType,
      fromDate: fromDay,
      toDate: toDay,
      numberOfDays: Number(data.numberOfDays),
      reason: data.reason,
      status: "pending",
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
   GET LEAVE BALANCE
============================ */
router.get("/balance/:employeeId", async (req, res) => {
  try {
    const counters = await LeaveCounter.find({
      employeeId: req.params.employeeId,
    })
      .select("leaveType balance totalAllowed used")
      .lean();

    if (!counters.length) {
      return res.status(404).json({
        success: false,
        message: "Leave balance not found",
      });
    }

    res.json({ success: true, data: counters });
  } catch (err) {
    console.error("Leave balance error:", err);
    res.status(500).json({ success: false, message: "Server error" });
  }
});

/* ============================
   UPDATE LEAVE BALANCE
============================ */

router.put("/update-status/:leaveId", async (req, res) => {
  try {
    const { status } = req.body;

    const leave = await EmployeeLeave.findById(req.params.leaveId);
    if (!leave) {
      return res.status(404).json({ success: false, message: "Leave not found" });
    }

    leave.status = status;
    await leave.save();

    // ✅ Reduce balance ONLY when approved
    if (status === "approved") {
      const counter = await LeaveCounter.findOne({
        employeeId: leave.employeeId,
        leaveType: leave.leaveType,
      });

      if (!counter) {
        return res.status(404).json({
          success: false,
          message: "Leave balance not found",
        });
      }

      counter.used += leave.numberOfDays;
      counter.balance = counter.totalAllowed - counter.used;

      await counter.save();
    }

    res.json({ success: true, message: "Leave updated successfully" });
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, message: "Server error" });
  }
});

/* ============================
   GET EMPLOYEE LEAVES
============================ */
router.get("/employee/:employeeId", async (req, res) => {
  try {
    const leaves = await EmployeeLeave.find({
      employeeId: req.params.employeeId,
    }).sort({ fromDate: -1 });

    res.json(leaves);
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

/* ============================
   GET PENDING LEAVES (ADMIN)
============================ */
router.get("/pending", async (req, res) => {
  try {
    const leaves = await EmployeeLeave.find({ status: "pending" })
      .sort({ createdAt: -1 });

    res.json(leaves);
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});


/* ============================
   UPDATE LEAVE STATUS
   APPROVE / REJECT
============================ */
router.put("/:id", async (req, res) => {
  try {
    let { status, rejectionReason } = req.body;

    // Convert "approved" from frontend to valid enum "accepted"
    if (status === "approved") status = "accepted";

    // Validate status
    if (!["accepted", "rejected"].includes(status)) {
      return res.status(400).json({
        success: false,
        message: "Invalid status value",
      });
    }

    // Find the leave request
    const leave = await EmployeeLeave.findById(req.params.id);
    if (!leave) {
      return res.status(404).json({
        success: false,
        message: "Leave not found",
      });
    }

    // Prevent double processing
    if (leave.status !== "pending") {
      return res.status(400).json({
        success: false,
        message: "Leave already processed",
      });
    }

    // ✅ If accepted → update leave counter
    if (status === "accepted") {
      const today = new Date();

      // Find leave counter (case-insensitive)
      const counter = await LeaveCounter.findOne({
        employeeId: leave.employeeId,
        leaveType: { $regex: `^${leave.leaveType.trim()}$`, $options: "i" },
        cycleStartDate: { $lte: today },
        nextResetDate: { $gte: today },
      });

      if (!counter) {
        return res.status(404).json({
          success: false,
          message: "Leave balance not found",
        });
      }

      // Atomic update to prevent race conditions
      const updatedCounter = await LeaveCounter.findOneAndUpdate(
        {
          _id: counter._id,
          balance: { $gte: leave.numberOfDays }, // ensure enough balance
        },
        {
          $inc: { used: leave.numberOfDays, balance: -leave.numberOfDays },
        },
        { new: true }
      );

      if (!updatedCounter) {
        return res.status(400).json({
          success: false,
          message: "Insufficient leave balance",
        });
      }
    }

    // Update leave status and rejection reason
    leave.status = status;
    leave.rejectionReason = status === "rejected" ? rejectionReason || "" : "";

    await leave.save();

    res.json({
      success: true,
      message: `Leave ${status} successfully`,
      leave,
    });
  } catch (err) {
    console.error("Leave Update Error:", err);
    res.status(500).json({
      success: false,
      message: "Server error",
      error: err.message,
    });
  }
});



module.exports = router;
