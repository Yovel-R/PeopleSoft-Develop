const express = require('express');
const router = express.Router();
const verifyTenant = require("../middleware/tenant.middleware");
const EmployeeTermination = require('../models/EmployeeTermination');
const Employee = require('../models/EmployeeModel');
const mongoose = require('mongoose');

// 🟢 CREATE - HR Direct Termination + Update Employee STATUS only
router.post("/", verifyTenant, async (req, res) => {
  const session = await mongoose.startSession();
  session.startTransaction();
  
  try {
    const { employeeId, reason, otherReason, showCauseNotice, showCauseNoticeDoc } = req.body;

    // Validation
    if (!employeeId || !reason) {
      throw new Error('Employee ID and termination reason are required');
    }

    // Check if employee exists
    const employee = await Employee.findOne({ EmployeeId: employeeId }).session(session);
    if (!employee) {
      throw new Error('Employee not found');
    }

    // Check if already terminated
    if (employee.status === 'terminated') {
      throw new Error('Employee is already terminated');
    }

    // Validate mandatory show-cause notice
    if (showCauseNotice && (!showCauseNoticeDoc || showCauseNoticeDoc.trim() === '')) {
      throw new Error('Show-cause notice document is required when checkbox is selected');
    }

    // 🔥 STEP 1: Create termination record
    const terminationData = new EmployeeTermination({
      ...req.body,
      status: 'terminated',
      terminatedAt: new Date(),
      terminatedBy: 'HR Admin'
    });

    const savedTermination = await terminationData.save({ session });

    // 🔥 STEP 2: Update ONLY employee.status to 'terminated'
    employee.status = 'terminated';
    await employee.save({ session });

    await session.commitTransaction();

    res.status(201).json({
      success: true,
      message: 'Employee terminated successfully (status updated)',
      terminationId: savedTermination._id,
      employeeId: employeeId
    });

  } catch (error) {
    await session.abortTransaction();
    console.error('Termination error:', error);
    res.status(400).json({
      success: false,
      message: error.message
    });
  } finally {
    session.endSession();
  }
});

// 🔍 GET ALL Terminations
router.get("/all", verifyTenant, async (req, res) => {
  try {
    const { page = 1, limit = 20 } = req.query;
    
    const terminations = await EmployeeTermination.find({ status: 'terminated' })
      .populate('employeeId', 'EmployeeId fullName status')
      .sort({ terminatedAt: -1 })
      .limit(limit * 1)
      .skip((page - 1) * limit)
      .lean();

    const total = await EmployeeTermination.countDocuments({ status: 'terminated' });

    res.json({
      success: true,
      data: terminations,
      pagination: {
        current: parseInt(page),
        pages: Math.ceil(total / limit),
        total
      }
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// 👤 GET Terminated Employees (Direct from Employee collection)
router.get("/terminated-employees", verifyTenant, async (req, res) => {
  try {
    const { page = 1, limit = 20 } = req.query;
    
    const employees = await Employee.find({ status: 'terminated' })
      .select('EmployeeId fullName department designation status')
      .sort({ updatedAt: -1 })
      .limit(limit * 1)
      .skip((page - 1) * limit)
      .lean();

    const total = await Employee.countDocuments({ status: 'terminated' });

    res.json({
      success: true,
      data: employees,
      pagination: {
        current: parseInt(page),
        pages: Math.ceil(total / limit),
        total
      }
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// 📊 Stats
router.get("/stats", verifyTenant, async (req, res) => {
  try {
    const totalTerminated = await Employee.countDocuments({ status: 'terminated' });
    
    const terminationReasons = await EmployeeTermination.aggregate([
      { $match: { status: 'terminated' } },
      { $group: { _id: '$reason', count: { $sum: 1 } } },
      { $sort: { count: -1 } },
      { $limit: 10 }
    ]);

    res.json({
      success: true,
      totalTerminated,
      topReasons: terminationReasons,
      terminatedEmployees: await Employee.countDocuments({ status: 'terminated' })
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

module.exports = router;
