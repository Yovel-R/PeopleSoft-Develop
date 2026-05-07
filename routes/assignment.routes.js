const express = require('express');
const mongoose = require('mongoose');
const router = express.Router();
const Employee = require('../models/EmployeeModel');
const Intern = require('../models/Intern');

// Fetch all managers
router.get('/managers', async (req, res) => {
  try {
    const managers = await Employee.find({ isManager: true }).select('fullName _id department role EmployeeId');
    res.json(managers);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Fetch all unassigned users (Interns & Employees combined)
router.get('/unassigned', async (req, res) => {
  try {
    const unassignedInterns = await Intern.find({
      status: { $in: ['approved', 'ongoing'] }
    }).populate('assignedManager', 'fullName')
      .select('fullName _id role department college email phone createdAt status assignedManager internid managerApprovalStatus');

    const unassignedEmployees = await Employee.find({
      status: { $in: ['active', 'approved'] },
      isManager: false
    }).populate('assignedManager', 'fullName')
      .select('fullName _id role department EmployeeId email phone assignedManager');

    res.json({
      interns: unassignedInterns,
      employees: unassignedEmployees
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Assign users to a manager
router.post('/assign', async (req, res) => {
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
router.get('/team/:managerId', async (req, res) => {
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

    res.json({
      interns,
      employees
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Fetch today's attendance for a manager's team (Interns & Employees)
router.get('/team-attendance/:managerId', async (req, res) => {
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
