const express = require("express");
const router = express.Router();
const AttendanceRequest = require("../models/attendanceRequest.model");
const Intern = require("../models/Intern");
const Attendance = require("../models/attendancemodel");

// 1. Intern Apply for Correction
router.post("/apply", async (req, res) => {
  try {
    const { internMongoId, date, requestedPunchIn, requestedPunchOut, reason } = req.body;
    
    // Find intern to get assigned manager
    const intern = await Intern.findById(internMongoId);
    if (!intern) return res.status(404).json({ success: false, message: "Intern not found" });
    
    if (!intern.assignedManager) {
      return res.status(400).json({ success: false, message: "No manager assigned to this intern. Cannot apply for correction." });
    }

    const request = new AttendanceRequest({
      internId: intern.internid,
      internMongoId,
      internName: intern.fullName,
      managerMongoId: intern.assignedManager,
      date: new Date(date),
      requestedPunchIn,
      requestedPunchOut,
      reason
    });

    await request.save();
    res.status(201).json({ success: true, message: "Correction request submitted to manager", request });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// 2. Get Requests for Manager
router.get("/manager/:managerId", async (req, res) => {
  try {
    const requests = await AttendanceRequest.find({ 
      managerMongoId: req.params.managerId,
      managerApprovalStatus: "pending" 
    }).sort({ createdAt: -1 });
    res.status(200).json(requests);
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// 3. Manager Review
router.put("/manager-review/:id", async (req, res) => {
  try {
    const { status, remarks } = req.body; // status: 'approved' or 'rejected'
    const request = await AttendanceRequest.findById(req.params.id);
    if (!request) return res.status(404).json({ success: false, message: "Request not found" });

    request.managerApprovalStatus = status;
    request.managerRemarks = remarks;
    request.managerActionDate = new Date();
    
    // If manager rejects, HR status also becomes rejected or stay pending? 
    // Usually manager rejection is final.
    if (status === "rejected") {
      request.hrApprovalStatus = "rejected";
    }

    await request.save();
    res.status(200).json({ success: true, message: `Request ${status} by manager`, request });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// 4. Get Requests for HR (Only those approved by Manager)
router.get("/hr-pending", async (req, res) => {
  try {
    const requests = await AttendanceRequest.find({ 
      managerApprovalStatus: "approved",
      hrApprovalStatus: "pending" 
    }).sort({ createdAt: -1 });
    res.status(200).json(requests);
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// 5. HR Review (Final)
router.put("/hr-review/:id", async (req, res) => {
  try {
    const { status, remarks } = req.body;
    const request = await AttendanceRequest.findById(req.params.id);
    if (!request) return res.status(404).json({ success: false, message: "Request not found" });

    request.hrApprovalStatus = status;
    request.hrRemarks = remarks;
    request.hrActionDate = new Date();

    if (status === "approved") {
      // UPDATE THE ACTUAL ATTENDANCE RECORD
      const targetDate = new Date(request.date);
      const dateStr = targetDate.toLocaleDateString("en-CA", { timeZone: "Asia/Kolkata" });

      // Find or create attendance record for that date
      let attendance = await Attendance.findOne({ 
        internId: request.internId, 
        date: dateStr 
      });

      if (!attendance) {
        attendance = new Attendance({
          internId: request.internId,
          fullName: request.internName,
          date: dateStr,
          status: "present" // Since we are correcting it to have times
        });
      }

      if (request.requestedPunchIn) attendance.punchInTime = request.requestedPunchIn;
      if (request.requestedPunchOut) attendance.punchOutTime = request.requestedPunchOut;
      
      attendance.status = "present"; // Force status to present if corrected
      await attendance.save();
    }

    await request.save();
    res.status(200).json({ success: true, message: `Request ${status} by HR`, request });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// 6. Get Intern's own requests
router.get("/intern/:internMongoId", async (req, res) => {
  try {
    const requests = await AttendanceRequest.find({ internMongoId: req.params.internMongoId }).sort({ createdAt: -1 });
    res.status(200).json(requests);
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

module.exports = router;
