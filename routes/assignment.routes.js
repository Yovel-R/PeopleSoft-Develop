const express = require('express');
const verifyTenant = require("../middleware/tenant.middleware");
const mongoose = require('mongoose');
const router = express.Router();
const Employee = require('../models/EmployeeModel');
const Intern = require('../models/Intern');
const Review = require('../models/internReview.model');
const EmployeeReview = require('../models/employeeReview.model');

// Fetch all managers
router.get("/managers", verifyTenant, async (req, res) => {
  try {
    const managers = await Employee.find({ 
      isManager: true,
      isHr: { $ne: true } 
    }).select('fullName _id department role EmployeeId isHr');
    res.json(managers);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Fetch all unassigned users (Interns & Employees combined)
router.get("/unassigned", verifyTenant, async (req, res) => {
  try {
    const unassignedInterns = await Intern.find({
      status: { $in: ['approved', 'ongoing'] },
      isHr: { $ne: true }
    }).populate('assignedManager', 'fullName')
      .select('fullName _id role department college email phone createdAt status assignedManager internid managerApprovalStatus isHr');

    const unassignedEmployees = await Employee.find({
      status: { $in: ['active', 'approved'] },
      isManager: false,
      isHr: { $ne: true }
    }).populate('assignedManager', 'fullName')
      .select('fullName _id role department EmployeeId email phone assignedManager isHr');

    res.json({
      interns: unassignedInterns,
      employees: unassignedEmployees
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Assign users to a manager
router.post("/assign", verifyTenant, async (req, res) => {
  const { managerId, userIds, userType } = req.body;
  if (!managerId || !userIds || !Array.isArray(userIds) || !userType) {
    return res.status(400).json({ error: 'managerId, userIds array, and userType are required.' });
  }

  try {
    const Model = userType === 'intern' ? Intern : Employee;
    
    // Update all matching users
    const result = await Model.updateMany(
      { _id: { $in: userIds } },
      { 
        $set: { 
          assignedManager: managerId,
          managerApprovalStatus: 'pending' 
        } 
      }
    );

    res.json({ message: `Successfully assigned ${result.modifiedCount} ${userType}s.`, result });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Fetch team members for a manager (Only approved and ongoing)
router.get("/team/:managerId", verifyTenant, async (req, res) => {
  try {
    const { managerId } = req.params;
    
    const interns = await Intern.find({ 
      assignedManager: managerId,
      status: { $in: ['approved', 'ongoing'] }
    }).select('fullName _id role department college email phone contact emergencyContact year onboardingDate endDate internshipType linkedin internid');
    
    const employees = await Employee.find({ 
      assignedManager: managerId,
      status: { $in: ['approved', 'ongoing', 'active'] }
    }).select('fullName _id role department EmployeeId email phone onboardingDate status qualification specialization college passingYear ugCgpa pgCgpa experienceYears emergencyPhone dob gender address linkedin');

    // Calculate current review month
    const now = new Date();
    const dateStr = now.toLocaleDateString("en-CA", { timeZone: "Asia/Kolkata" });
    const parts = dateStr.split("-");
    let year = parseInt(parts[0]);
    let month = parseInt(parts[1]);
    const day = parseInt(parts[2]);

    if (day <= 5) {
      month--;
      if (month === 0) {
        month = 12;
        year--;
      }
    }
    const monthStr = `${year}-${String(month).padStart(2, "0")}`;

    // Find graded reviews for the current month
    const companyId = req.tenant.companyId;
    const gradedInterns = await Review.find({
      companyId,
      date: { $regex: `^${monthStr}` },
      isGraded: true
    }).select('internId');
    const gradedInternIds = new Set(gradedInterns.map(r => r.internId));

    const gradedEmployees = await EmployeeReview.find({
      companyId,
      date: { $regex: `^${monthStr}` },
      isGraded: true
    }).select('employeeId');
    const gradedEmployeeIds = new Set(gradedEmployees.map(e => e.employeeId));

    const internsWithStatus = interns.map(intern => {
      const internObj = intern.toObject();
      internObj.isReviewed = gradedInternIds.has(intern.internid);
      return internObj;
    });

    const employeesWithStatus = employees.map(emp => {
      const empObj = emp.toObject();
      empObj.isReviewed = gradedEmployeeIds.has(emp.EmployeeId);
      return empObj;
    });

    res.json({
      interns: internsWithStatus,
      employees: employeesWithStatus
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Fetch today's attendance for a manager's team (Interns & Employees)
router.get("/team-attendance/:managerId", verifyTenant, async (req, res) => {
  try {
    const { managerId } = req.params;
    const today = new Date().toLocaleDateString("en-CA", { timeZone: "Asia/Kolkata" });

    // 1. Fetch Intern Attendance
    const internAttendance = await Intern.aggregate([
      { $match: { assignedManager: new mongoose.Types.ObjectId(managerId), status: { $in: ['approved', 'ongoing'] } } },
      {
        $lookup: {
          from: "attendances",
          let: { internId: "$internid" },
          pipeline: [
            { $match: { $expr: { $eq: ["$internId", "$$internId"] }, date: today } }
          ],
          as: "attendance"
        }
      },
      { $unwind: { path: "$attendance", preserveNullAndEmptyArrays: true } },
      {
        $project: {
          name: "$fullName",
          id: "$internid",
          type: { $literal: "Intern" },
          punchIn: "$attendance.punchInTime",
          punchOut: "$attendance.punchOutTime",
          duration: { $ifNull: ["$attendance.duration", "--:--"] }
        }
      }
    ]);

    // 2. Fetch Employee Attendance
    const employeeAttendance = await Employee.aggregate([
      { $match: { assignedManager: new mongoose.Types.ObjectId(managerId), status: { $in: ['approved', 'ongoing', 'active'] } } },
      {
        $lookup: {
          from: "employeeattendances",
          let: { empId: "$EmployeeId" },
          pipeline: [
            { $match: { $expr: { $eq: ["$employeeId", "$$empId"] }, date: today } }
          ],
          as: "attendance"
        }
      },
      { $unwind: { path: "$attendance", preserveNullAndEmptyArrays: true } },
      {
        $project: {
          name: "$fullName",
          id: "$EmployeeId",
          type: { $literal: "Employee" },
          punchIn: "$attendance.punchInTime",
          punchOut: "$attendance.punchOutTime",
          duration: { $ifNull: ["$attendance.duration", "--:--"] }
        }
      }
    ]);

    res.json({
      date: today,
      teamAttendance: [...internAttendance, ...employeeAttendance]
    });
  } catch (error) {
    console.error("Error in /team-attendance:", error);
    res.status(500).json({ error: error.message });
  }
});

module.exports = router;
