const express = require("express");
const Employee = require("../models/EmployeeModel");
const LeaveCounter = require("../models/leaveCounter.model"); 
const { sendEmail, LOGO_URL } = require("../utilities/sendEmail");
const { getSignature } = require("../utilities/emailSignature");
const multer = require("multer");
const ExcelJS = require("exceljs");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const verifyTenant = require("../middleware/tenant.middleware");


const router = express.Router();
const upload = multer({ storage: multer.memoryStorage() });

/* ============================
   ADD / ONBOARD (INITIAL)
============================ */
const User = require("../models/User");
const Role = require("../models/Role");

const verifyPublicTenant = require("../middleware/publicTenant.middleware");

router.post(
  "/add",
  upload.any(), // parse multipart/form-data FIRST
  verifyPublicTenant,
  async (req, res) => {
    try {
      console.log("BODY:", req.body);   // employee fields
      
      // 1. Check if user already exists in this company
      const existingUser = await User.findOne({ companyId: req.tenant.companyId, email: req.body.email });
      if (existingUser) {
        return res.status(400).json({ message: "An application with this email already exists for this company." });
      }

      // 2. Find or Create the Default EMPLOYEE Role for this company
      let employeeRole = await Role.findOne({ companyId: req.tenant.companyId, name: 'EMPLOYEE' });
      if (!employeeRole) {
        employeeRole = new Role({
          companyId: req.tenant.companyId,
          name: 'EMPLOYEE',
          description: 'Standard employee permissions',
          permissions: ['VIEW_DASHBOARD', 'REQUEST_LEAVE'],
          isSystemDefined: true
        });
        await employeeRole.save();
      }

      // 2. Create User in unified collection
      const newUser = new User({
        companyId: req.tenant.companyId,
        email: req.body.email,
        password: "", // Will be set on first login
        roleId: employeeRole._id,
        profile: {
          firstName: req.body.fullName, // Legacy field name mapping
          phone: req.body.phone,
          dob: req.body.dob,
          address: req.body.address,
          gender: req.body.gender,
          nationality: req.body.nationality,
          maritalStatus: req.body.maritalStatus,
          emergencyContact: {
            name: req.body.emergencyName,
            phone: req.body.emergencyPhone
          }
        },
        employment: {
          type: 'FULL_TIME',
          designation: req.body.designation || req.body.role,
          status: 'ONBOARDING'
        },
        education: {
          qualification: req.body.qualification,
          specialization: req.body.specialization,
          college: req.body.college,
          passingYear: req.body.passingYear,
          ugCgpa: req.body.ugCgpa,
          pgCgpa: req.body.pgCgpa
        },
        experience: {
          isExperienced: req.body.isExperienced === 'true' || req.body.isExperienced === true,
          years: req.body.experienceYears,
          previousOrg: req.body.previousOrg,
          designation: req.body.designation
        },
        system: {
          onboardingStatus: 'initial',
          declaration: req.body.declaration === 'true' || req.body.declaration === true,
          bgConsent: req.body.bgConsent === 'true' || req.body.bgConsent === true,
          whatsappConsent: req.body.whatsappConsent === 'true' || req.body.whatsappConsent === true
        }
      });

      await newUser.save();

      // 3. ALSO Create Employee in legacy collection (Backward Compatibility for Admin Dashboard)
      const newEmployee = new Employee({
        companyId: req.tenant.companyId,
        fullName: req.body.fullName,
        email: req.body.email,
        phone: req.body.phone,
        emergencyName: req.body.emergencyName,
        emergencyPhone: req.body.emergencyPhone,
        dob: req.body.dob,
        address: req.body.address,
        role: req.body.designation || req.body.role,
        department: req.body.department,
        linkedin: req.body.linkedin,
        gender: req.body.gender,
        nationality: req.body.nationality,
        maritalStatus: req.body.maritalStatus,
        qualification: req.body.qualification,
        specialization: req.body.specialization,
        college: req.body.college,
        passingYear: req.body.passingYear,
        ugCgpa: req.body.ugCgpa,
        pgCgpa: req.body.pgCgpa,
        isExperienced: req.body.isExperienced === 'true' || req.body.isExperienced === true,
        experienceYears: req.body.experienceYears,
        previousOrg: req.body.previousOrg,
        designation: req.body.designation,
        declaration: req.body.declaration === 'true' || req.body.declaration === true,
        bgConsent: req.body.bgConsent === 'true' || req.body.bgConsent === true,
        whatsappConsent: req.body.whatsappConsent === 'true' || req.body.whatsappConsent === true,
        status: 'initial'
      });

      await newEmployee.save();

      // Trigger Real-Time Dashboard/Approvals Update
      const io = req.app.get('io');
      if (io) {
        io.emit('activity-updated', { type: 'new_employee', employee: newEmployee });
      }

      // Map uploaded files to attachments
      const attachments = req.files?.map(file => ({
        filename: file.originalname,
        content: file.buffer,
      }));

      // Send email to receiver
      await sendEmail({
        to: req.tenant.receivingEmail,
        subject: `New Employee Submission: ${newUser.profile.firstName}`,
        html: `
          <h3>New employee submission received</h3>
          <p>Name: ${newUser.profile.firstName}</p>
          <p>Email: ${newUser.email}</p>
          <p>Phone: ${newUser.profile.phone}</p>
        `,
        attachments,
        replyTo: req.tenant.receivingEmail,
      });

      res.status(200).json({ message: "Employee submitted & email sent", userId: newUser._id });
    } catch (err) {
      console.error("Employee Add Error:", err);
      res.status(500).json({ message: "Server error", error: err.message });
    }
  }
);

module.exports = router;
/* ============================
   GET INITIAL EMPLOYEES
============================ */
router.get("/all/initial", verifyTenant, async (req, res) => {
  const employees = await Employee.find({ status: "initial", companyId: req.tenant.companyId });
  res.json(employees);
});

/* ============================
   GET ACTIVE EMPLOYEES
============================ */
/* ===================================================
   GET ALL PENDING EMPLOYEES (status: initial) — for HR Approvals Hub
=================================================== */
router.get("/all/pending", verifyTenant, async (req, res) => {
  try {
    const employees = await Employee.find({
      status: "initial",
      companyId: req.tenant.companyId
    })
      .sort({ submittedAt: -1 })
      .lean();
    res.json(employees);
  } catch (err) {
    console.error("Fetch Pending Employees Error:", err);
    res.status(500).json({ message: "Server error" });
  }
});

router.get("/all/active", verifyTenant, async (req, res) => {
  try {
    const { range = "all", status = "all" } = req.query;

    const statusFilter = status === "all" ? ["approved", "ongoing"] : [status];

    const query = { status: { $in: statusFilter }, companyId: req.tenant.companyId };

    const now = new Date();
    let start, end;

    if (range === "thisMonth") {
      start = new Date(now.getFullYear(), now.getMonth(), 1);
      end = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59);
    } else if (range === "sixMonths") {
      start = new Date(now.getFullYear(), now.getMonth() - 5, 1);
      end = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59);
    } else if (range === "all") {
      // ✅ ALL TIME - no date filter
      start = null;
      end = null;
    }

    // ✅ FIXED: Use submittedAt instead of createdAt
    if (start && end) {
      query.submittedAt = { $gte: start, $lte: end };
    }

    const employees = await Employee.find(query)
      .sort({ submittedAt: -1 })
      .lean();

    console.log(`Found ${employees.length} employees`);
    res.json(employees);
  } catch (err) {
    console.error("Fetch Active Employees Error:", err);
    res.status(500).json({ message: "Server error" });
  }
});

/* ============================
   GET SINGLE EMPLOYEE
============================ */
router.get("/get/:id", verifyTenant, async (req, res) => {
  try {
    const { id } = req.params;
    console.log(`[DEBUG] Fetching employee with ID: ${id}`);
    
    let employee;
    
    // 1. Try finding by MongoDB ObjectId first
    if (id.match(/^[0-9a-fA-F]{24}$/)) {
      employee = await Employee.findOne({ _id: id, companyId: req.tenant.companyId });
    } 
    
    // 2. If not found or not an ObjectId, try finding by custom EmployeeId (case-insensitive)
    if (!employee) {
      employee = await Employee.findOne({ 
        EmployeeId: { $regex: new RegExp(`^${id}$`, 'i') },
        companyId: req.tenant.companyId 
      });
    }

    if (!employee) {
      console.log(`[DEBUG] Employee NOT found for ID: ${id}`);
      return res.status(404).json({ message: "Employee not found" });
    }
    
    console.log(`[DEBUG] Employee found: ${employee.fullName} (${employee.EmployeeId || 'No custom ID'})`);
    res.json({ employee });
  } catch (err) {
    console.error("Fetch Single Employee Error:", err);
    res.status(500).json({ message: "Server error" });
  }
});

/* ============================
   ACCEPT EMPLOYEE (PDF + MAIL)
============================ */
router.put("/accept/:id", verifyTenant, async (req, res) => {
  try {
    const { onboardingDate } = req.body;
    const employee = await Employee.findOne({ _id: req.params.id, companyId: req.tenant.companyId });
    if (!employee) return res.status(404).json({ message: "Employee not found" });

    // Generate unique Employee ID
    const newEmployeeId = await generateEmployeeId(req.tenant.companyId);
    employee.EmployeeId = newEmployeeId;
    employee.status = "approved";
    employee.onboardingDate = onboardingDate;

    await employee.save();

    // 2. Synchronize with User Record (Unified Collection)
    const updatedUser = await User.findOneAndUpdate(
      { email: { $regex: new RegExp(`^${employee.email.trim()}$`, 'i') }, companyId: req.tenant.companyId },
      { 
        'employment.status': 'approved',
        'employment.joinedAt': onboardingDate,
        'system.onboardingStatus': 'completed'
      },
      { new: true }
    );

    if (updatedUser) {
      console.log(`[DEBUG] Updated User record for approved employee: ${employee.email}`);
    } else {
      console.log(`[DEBUG] Warning: No User record found for approved employee: ${employee.email}`);
    }

    // 3. Initialize leave counter
    const startDate = new Date(onboardingDate);
    const nextResetDate = new Date(startDate);
    nextResetDate.setFullYear(startDate.getFullYear() + 1);

    const leaveConfigs = [
      { type: "Casual Leave", days: 9 },
      { type: "Sick Leave", days: 12 },
      { type: "Bereavement Leave", days: 3 },
    ];

    const records = leaveConfigs.map(l => ({
      companyId: req.tenant.companyId,
      employeeId: newEmployeeId,
      leaveType: l.type,
      totalAllowed: l.days,
      used: 0,
      balance: l.days,
      cycleStartDate: startDate,
      nextResetDate,
    }));

    await LeaveCounter.insertMany(records, { ordered: false }).catch(() => {});

    // 4. Send approval email (Wrapped in try-catch to avoid failing the whole request if email fails)
    try {
      await sendEmail({
        to: employee.email,
        subject: "Your Employee ID is Ready",
        html: `<div style="font-family: sans-serif; line-height: 1.6; color: #333;">
                 <h2>Hi ${employee.fullName},</h2>
                 <p>Your profile has been <b>approved</b> 🎉</p>
                 <p><b>Employee ID:</b> ${newEmployeeId}</p>
                 <p><b>Onboarding Date:</b> ${onboardingDate}</p>
                 ${getSignature(LOGO_URL)}
               </div>`,
      });
      console.log(`[DEBUG] Approval email sent to: ${employee.email}`);
    } catch (emailErr) {
      console.error("[DEBUG] Failed to send approval email:", emailErr);
      // We do NOT return error here, because the DB records are already updated successfully
    }

    res.json({ success: true, message: "Employee approved & onboarded successfully", employee });
  } catch (err) {
    console.error("Employee Accept Error:", err);
    res.status(500).json({ message: "Server error", error: err.message });
  }
});

/* ============================
   REJECT EMPLOYEE / DELETE
============================ */
router.delete("/delete/:id", verifyTenant, async (req, res) => {
  try {
    const { id } = req.params;
    let query = { companyId: req.tenant.companyId };
    
    if (id.match(/^[0-9a-fA-F]{24}$/)) {
      query._id = id;
    } else {
      query.EmployeeId = { $regex: new RegExp(`^${id}$`, 'i') };
    }

    const employee = await Employee.findOneAndDelete(query);

    if (!employee) {
      return res.status(404).json({ message: "Employee not found" });
    }

    res.json({ message: "Employee deleted successfully", employee });
  } catch (error) {
    res.status(500).json({ message: "Server error", error });
  }
});

// Alias for delete to match some frontend calls
router.delete("/reject/:id", verifyTenant, async (req, res) => {
  try {
    const { id } = req.params;
    let query = { companyId: req.tenant.companyId };
    
    if (id.match(/^[0-9a-fA-F]{24}$/)) {
      query._id = id;
    } else {
      query.EmployeeId = { $regex: new RegExp(`^${id}$`, 'i') };
    }

    const employee = await Employee.findOneAndDelete(query);
    if (!employee) return res.status(404).json({ message: "Employee not found" });
    res.json({ message: "Employee rejected/deleted", employee });
  } catch (error) {
    res.status(500).json({ message: "Server error", error });
  }
});

const authController = require("../controllers/AuthController");
router.post("/login", authController.login);

/* ============================
   MANAGER LOGIN (BY EMAIL)
============================ */
router.post("/manager/login", async (req, res) => {
  try {
    const { email, password } = req.body;
    const manager = await Employee.findOne({ email: { $regex: new RegExp(`^${email}$`, 'i') }, isManager: true });

    if (!manager) {
      return res.status(404).json({ message: "Manager not found or unauthorized" });
    }

    if (!manager.password) {
      manager.password = password;
      await manager.save();
      return res.json({ message: "First-time password set", firstTime: true, manager });
    }

    let isMatch = false;
    if (manager.password.length === 60 || manager.password.startsWith('$2a$') || manager.password.startsWith('$2b$')) {
        isMatch = await bcrypt.compare(password, manager.password);
    } else {
        isMatch = (manager.password === password);
        if (isMatch) {
            const salt = await bcrypt.genSalt(10);
            manager.password = await bcrypt.hash(password, salt);
            await manager.save();
        }
    }

    if (!isMatch) {
      return res.status(401).json({ message: "Wrong password" });
    }

    const token = jwt.sign(
      { user: { id: manager.id, companyId: manager.companyId, role: 'manager' } },
      process.env.JWT_SECRET || 'fallback_secret_key',
      { expiresIn: '1d' }
    );

    res.json({ message: "Login successful", firstTime: false, manager, token });
  } catch (error) {
    res.status(500).json({ message: "Server error", error: error.message });
  }
});

/* ============================
   EMPLOYEE ID GENERATOR
============================ */
const Counter = require("../models/counter.model");
const Company = require("../models/CompanyModel");

async function generateEmployeeId(companyId) {
  // Fetch company code
  const company = await Company.findById(companyId);
  const companyCode = company ? company.companyCode : "UNKNOWN";

  // Find counter for this company and 'employee' type
  const counter = await Counter.findOneAndUpdate(
    { companyId: companyId, type: 'employee' },
    { $inc: { seq: 1 } },
    { new: true, upsert: true }
  );

  // Pad seq to 3 digits (e.g., 001, 002)
  return `${companyCode}-EMP-${String(counter.seq).padStart(3, "0")}`;
}



router.get("/export/excel/all-employees", verifyTenant, async (req, res) => {
  try {
    const { status = "all", from, to, managerId } = req.query;

    const query =
      status === "all"
        ? { companyId: req.tenant.companyId }
        : { status, companyId: req.tenant.companyId };

    if (managerId) {
      query.assignedManager = managerId;
    }

    let employees = await Employee.find(query).sort({ submittedAt: -1 });

    if (from && to) {
      const fromDate = new Date(from);
      const toDate = new Date(to);
      toDate.setHours(23, 59, 59, 999);

      employees = employees.filter((emp) => {
        if (!emp.onboardingDate) return false;
        const onboardDate = new Date(emp.onboardingDate);
        if (isNaN(onboardDate)) return false;
        return onboardDate >= fromDate && onboardDate <= toDate;
      });
    }

    const workbook = new ExcelJS.Workbook();
    const sheet = workbook.addWorksheet("Employees");

    sheet.columns = [
      { header: "Employee ID", key: "EmployeeId", width: 18 },
      { header: "Full Name", key: "fullName", width: 25 },
      { header: "Email", key: "email", width: 30 },
      { header: "Phone", key: "phone", width: 18 },
      { header: "Status", key: "status", width: 15 },
      { header: "Role", key: "role", width: 20 },
      { header: "Onboarding Date", key: "onboardingDate", width: 18 },
      { header: "Date of Birth", key: "dob", width: 15 },
      { header: "Gender", key: "gender", width: 12 },
      { header: "Nationality", key: "nationality", width: 15 },
      { header: "Marital Status", key: "maritalStatus", width: 15 },

      // Education
      { header: "Qualification", key: "qualification", width: 18 },
      { header: "Specialization", key: "specialization", width: 20 },
      { header: "College", key: "college", width: 25 },
      { header: "Passing Year", key: "passingYear", width: 15 },

      // CGPA
      { header: "UG CGPA", key: "ugCgpa", width: 12 },
      { header: "PG CGPA", key: "pgCgpa", width: 12 },

      // Experience
      { header: "Experienced", key: "isExperienced", width: 15 },
      { header: "Experience Years", key: "experienceYears", width: 18 },
      { header: "Previous Organization", key: "previousOrg", width: 25 },
      { header: "Designation", key: "designation", width: 20 },

      // Emergency
      { header: "Emergency Contact Name", key: "emergencyName", width: 25 },
      { header: "Emergency Contact Phone", key: "emergencyPhone", width: 20 },

      { header: "Submitted At", key: "submittedAt", width: 22 },
    ];

    employees.forEach((emp) => {
      sheet.addRow({
        EmployeeId: emp.EmployeeId || "",
        fullName: emp.fullName || "",
        email: emp.email || "",
        phone: emp.phone || "",
        status: emp.status || "",
        role: emp.role || "",
        onboardingDate: emp.onboardingDate
          ? new Date(emp.onboardingDate).toLocaleDateString("en-GB")
          : "",
        dob: emp.dob
          ? new Date(emp.dob).toLocaleDateString("en-GB")
          : "",
        gender: emp.gender || "",
        nationality: emp.nationality || "",
        maritalStatus: emp.maritalStatus || "",

        qualification: emp.qualification || "",
        specialization: emp.specialization || "",
        college: emp.college || "",
        passingYear: emp.passingYear || "",

        ugCgpa: emp.ugCgpa ?? "",
        pgCgpa: emp.pgCgpa ?? "",

        isExperienced: emp.isExperienced ? "Yes" : "No",
        experienceYears: emp.experienceYears || "",
        previousOrg: emp.previousOrg || "",
        designation: emp.designation || "",

        emergencyName: emp.emergencyName || "",
        emergencyPhone: emp.emergencyPhone || "",

        submittedAt: emp.submittedAt
          ? new Date(emp.submittedAt).toLocaleDateString("en-GB")
          : "",
      });
    });

    // Header styling
    sheet.getRow(1).font = { bold: true };

    res.setHeader(
      "Content-Type",
      "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
    );
    res.setHeader(
      "Content-Disposition",
      "attachment; filename=Employee_Data.xlsx"
    );

    await workbook.xlsx.write(res);
    res.end();

  } catch (err) {
    console.error("Employee Excel Export Error:", err);
    res.status(500).json({ message: "Employee Excel export failed" });
  }
});


// Toggle Manager Status
router.put("/toggle-manager/:id", verifyTenant, async (req, res) => {
  try {
    const { id } = req.params;
    const employee = await Employee.findOne({ _id: id, companyId: req.tenant.companyId });
    if (!employee) {
      return res.status(404).json({ message: "Employee not found" });
    }

    employee.isManager = !employee.isManager;
    await employee.save();

    res.json({ 
      message: `Employee ${employee.isManager ? 'promoted to' : 'removed from'} manager role`,
      isManager: employee.isManager 
    });
  } catch (err) {
    console.error("Toggle Manager Error:", err);
    res.status(500).json({ message: "Server error" });
  }
});

router.put("/update/:id", verifyTenant, async (req, res) => {
  try {
    const { id } = req.params;
    let query = { companyId: req.tenant.companyId };
    
    if (id.match(/^[0-9a-fA-F]{24}$/)) {
      query._id = id;
    } else {
      query.EmployeeId = { $regex: new RegExp(`^${id}$`, 'i') };
    }

    const updatedEmployee = await Employee.findOneAndUpdate(
      query,
      { $set: req.body },
      { new: true }
    );

    if (!updatedEmployee) return res.status(404).json({ message: "Employee not found" });

    // Sync with User record if email, profile fields, or payroll changed
    if (req.body.email || req.body.fullName || req.body.phone || req.body.payroll) {
      const updateData = {};
      if (req.body.fullName) updateData['profile.firstName'] = updatedEmployee.fullName;
      if (req.body.phone) updateData['profile.phone'] = updatedEmployee.phone;
      if (req.body.designation || req.body.role) updateData['employment.designation'] = updatedEmployee.designation || updatedEmployee.role;
      if (req.body.payroll) updateData['payroll'] = updatedEmployee.payroll;

      await User.findOneAndUpdate(
        { email: { $regex: new RegExp(`^${updatedEmployee.email.trim()}$`, 'i') }, companyId: req.tenant.companyId },
        { $set: updateData }
      );
    }

    res.json({ message: "Employee updated successfully", employee: updatedEmployee });
  } catch (err) {
    console.error("Employee Update Error:", err);
    res.status(500).json({ message: "Server error", error: err.message });
  }
});

/* ============================
   GET EMPLOYEES ASSIGNED TO MANAGER (INITIAL STATUS)
============================ */
router.get("/assigned-to/:managerId", verifyTenant, async (req, res) => {
  try {
    const employees = await Employee.find({ 
      assignedManager: req.params.managerId,
      status: "initial"
    });
    res.json(employees);
  } catch (error) {
    res.status(500).json({ message: "Server error", error });
  }
});

/* ============================
   MANAGER REVIEW OF EMPLOYEE ONBOARDING
============================ */
router.put("/manager-review/:id", verifyTenant, async (req, res) => {
  try {
    const { status, remarks } = req.body; // status: 'approved' | 'rejected'
    const employee = await Employee.findById(req.params.id);
    if (!employee) return res.status(404).json({ message: "Employee not found" });

    employee.managerApprovalStatus = status;
    employee.managerRemarks = remarks;
    await employee.save();

    res.json({ message: `Employee onboarding request ${status} by manager`, employee });
  } catch (error) {
    res.status(500).json({ message: "Server error", error });
  }
});

module.exports = router;
