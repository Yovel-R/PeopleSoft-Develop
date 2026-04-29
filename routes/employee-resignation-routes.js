const express = require("express");
const router = express.Router();
const EmployeeResignation = require("../models/employee-resignation-model");

// Employee submit resignation
router.post("/", async (req, res) => {
  try {
    const {
      employeeId,
      fullName,
      department,
      designation,
      applyDate,
      noticePeriodMonths,
      lastWorkingDay,
      reason,
      additionalComments,
    } = req.body;

    console.log('📥 Resignation submission:', { employeeId, fullName });

    // Validate required fields
    if (!employeeId || !fullName || !department || !designation || !applyDate || !lastWorkingDay || !reason) {
      return res.status(400).json({ message: "Missing required fields" });
    }

    // Prevent duplicate submissions
    const existing = await EmployeeResignation.findOne({
      employeeId,
      status: { $in: ["pending", "approved"] },
    });

    if (existing) {
      return res.status(409).json({
        message: "You already have a resignation request in process or approved.",
      });
    }

    // Create new resignation (default status: pending)
    const resignation = new EmployeeResignation({
      employeeId,
      fullName,
      department,
      designation,
      applyDate,
      noticePeriodMonths,
      lastWorkingDay,
      reason,
      additionalComments,
      status: "pending", // Default status
    });

    await resignation.save();
    
    console.log('✅ Resignation created:', resignation._id);
    res.status(201).json({
      message: "Resignation submitted successfully",
      data: resignation,
    });
  } catch (err) {
    console.error("❌ Error creating resignation:", err);
    res.status(500).json({ message: "Server error" });
  }
});

// HR: List all resignations with status filter
router.get("/", async (req, res) => {
  try {
    const { status } = req.query;
    const query = {};
    
    if (status && status !== "all") {
      query.status = status;
    }

    const resignations = await EmployeeResignation
      .find(query)
      .sort({ createdAt: -1 })
      .lean(); // Use lean() for better performance

    console.log(`📋 Fetched ${resignations.length} resignations (status: ${status || 'all'})`);
    
    res.json({ 
      data: resignations,
      count: resignations.length,
      filters: ["all", "pending", "approved", "rejected"]
    });
  } catch (err) {
    console.error("❌ Error listing resignations:", err);
    res.status(500).json({ message: "Server error" });
  }
});

// HR: Update resignation status (unified endpoint)
router.patch("/:id/status", async (req, res) => {
  try {
    const { id } = req.params;
    const { status, rejectionReason } = req.body;

    // Validate status
    const validStatuses = ["approved", "rejected"];
    if (!validStatuses.includes(status)) {
      return res.status(400).json({ 
        message: "Invalid status. Must be 'approved' or 'rejected'" 
      });
    }

    const resignation = await EmployeeResignation.findById(id);
    if (!resignation) {
      return res.status(404).json({ message: "Resignation not found" });
    }

    if (resignation.status !== "pending") {
      return res.status(400).json({ 
        message: `Resignation already ${resignation.status}` 
      });
    }

    // Update status
    resignation.status = status;
    
    if (status === "rejected" && (!rejectionReason || !rejectionReason.trim())) {
      return res.status(400).json({ message: "Rejection reason is required" });
    }
    
    if (status === "rejected") {
      resignation.rejectionReason = rejectionReason?.trim();
    } else {
      resignation.rejectionReason = ""; // Clear on approval
    }

    await resignation.save();

    console.log(`🔄 ${status.toUpperCase()} - ${resignation.employeeId} (${resignation.fullName})`);
    
    res.json({
      message: `Resignation ${status}`,
      data: resignation,
    });
  } catch (err) {
    console.error("❌ Error updating resignation status:", err);
    res.status(500).json({ message: "Server error" });
  }
});

// HR: Get single resignation details
router.get("/:id", async (req, res) => {
  try {
    const { id } = req.params;
    const resignation = await EmployeeResignation.findById(id).lean();
    
    if (!resignation) {
      return res.status(404).json({ message: "Resignation not found" });
    }
    
    res.json({ data: resignation });
  } catch (err) {
    console.error("❌ Error fetching resignation:", err);
    res.status(500).json({ message: "Server error" });
  }
});

module.exports = router;
