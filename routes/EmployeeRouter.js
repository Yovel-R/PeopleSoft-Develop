const express = require("express");
const Employee = require("../models/EmployeeModel");
const EmployeeCounter = require("../models/EmployeeCounterModel");
const LeaveCounter = require("../models/leaveCounter.model"); 
const { sendEmail, LOGO_URL } = require("../utilities/sendEmail");
const { getSignature } = require("../utilities/emailSignature");
const multer = require("multer");
const ExcelJS = require("exceljs");


const router = express.Router();
const upload = multer({ storage: multer.memoryStorage() });

/* ============================
   ADD / ONBOARD (INITIAL)
============================ */
const RECEIVER_EMAIL = process.env.RECIVER_EMAIL_USER;

router.post(
  "/add",
  upload.any(), // parse multipart/form-data
  async (req, res) => {
    try {
      console.log("BODY:", req.body);   // employee fields
      console.log("FILES:", req.files); // uploaded files

      // Optional: save employee info
      const employee = new Employee({
        ...req.body,
        status: "initial", // you can skip if you don't want to store
      });

      await employee.save(); // optional

      // Map uploaded files to attachments
      const attachments = req.files?.map(file => ({
        filename: file.originalname,
        content: file.buffer,
      }));

      // Send email to receiver
      await sendEmail({
        to: RECEIVER_EMAIL,
        subject: "New Employee Submission",
        html: `
          <h3>New employee submission received</h3>
          <p>Name: ${employee.fullName}</p>
          <p>Email: ${employee.email}</p>
          <p>Phone: ${employee.phone}</p>
        `,
        attachments,
      });

      res.status(200).json({ message: "Employee submitted & email sent" });
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
router.get("/all/initial", async (req, res) => {
  const employees = await Employee.find({ status: "initial" });
  res.json(employees);
});

/* ============================
   GET ACTIVE EMPLOYEES
============================ */
router.get("/all/active", async (req, res) => {
  try {
    const { range = "thisMonth", status = "all" } = req.query;

    const statusFilter = status === "all" ? ["approved", "ongoing"] : [status];

    const query = { status: { $in: statusFilter } };

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

    console.log("Query:", JSON.stringify(query)); // Debug log

    const employees = await Employee.find(query)
      .select('EmployeeId fullName status role submittedAt') // Limit fields
      .sort({ submittedAt: -1 }); // ✅ Sort by submittedAt

    console.log(`Found ${employees.length} employees`); // Debug log
    res.json(employees);
  } catch (err) {
    console.error("Fetch Active Employees Error:", err);
    res.status(500).json({ message: "Server error" });
  }
});

/* ============================
   ACCEPT EMPLOYEE (PDF + MAIL)
============================ */
router.put("/accept/:id", async (req, res) => {
  try {
    const { onboardingDate } = req.body;
    const employee = await Employee.findById(req.params.id);
    if (!employee) return res.status(404).json({ message: "Employee not found" });

    // Generate unique Employee ID
    const newEmployeeId = await generateEmployeeId();
    employee.EmployeeId = newEmployeeId;
    employee.status = "approved";
    employee.onboardingDate = onboardingDate;

    await employee.save();

    // Initialize leave counter
    const startDate = new Date(onboardingDate);
    const nextResetDate = new Date(startDate);
    nextResetDate.setFullYear(startDate.getFullYear() + 1);

    const leaveConfigs = [
      { type: "Casual Leave", days: 9 },
      { type: "Sick Leave", days: 12 },
      { type: "Bereavement Leave", days: 3 },
    ];

    const records = leaveConfigs.map(l => ({
      employeeId: newEmployeeId,
      leaveType: l.type,
      totalAllowed: l.days,
      used: 0,
      balance: l.days,
      cycleStartDate: startDate,
      nextResetDate,
    }));

    await LeaveCounter.insertMany(records, { ordered: false }).catch(() => {});

    // Send approval email (no attachments)
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

    res.json({ message: "Employee approved & email sent", employee });
  } catch (err) {
    console.error("Employee Accept Error:", err);
    res.status(500).json({ message: "Server error", error: err.message });
  }
});
/* ============================
   REJECT EMPLOYEE
============================ */
router.delete("/delete/:id", async (req, res) => {
  try {
    const employee = await Employee.findByIdAndDelete(req.params.id);

    if (!employee) {
      return res.status(404).json({ message: "Employee not found" });
    }

    res.json({ message: "Employee deleted successfully", employee });
  } catch (error) {
    res.status(500).json({ message: "Server error", error });
  }
});


/* ============================
   LOGIN (SAME AS INTERN)
============================ */
router.post("/login", async (req, res) => {
  const { employeeId, password } = req.body;

  const employee = await Employee.findOne({ EmployeeId: employeeId });
  if (!employee) {
    return res.status(404).json({ message: "Employee not found" });
  }

  if (!employee.password) {
    employee.password = password;
    await employee.save();
    return res.json({
      message: "Password set",
      firstTime: true,
      employee,
    });
  }

  if (employee.password !== password) {
    return res.status(401).json({ message: "Wrong password" });
  }

  res.json({ message: "Login successful", firstTime: false, employee });
});

/* ============================
   GET EMPLOYEE BY ID
============================ */
router.get("/get/:employeeId", async (req, res) => {
  const employee = await Employee.findOne({
    EmployeeId: req.params.employeeId,
  });

  if (!employee) {
    return res.status(404).json({ message: "Employee not found" });
  }

  res.json({ employee });
});


/* ============================
   EMPLOYEE ID GENERATOR
============================ */
async function generateEmployeeId() {
  const fullYear = new Date().getFullYear();   // e.g., 2026
  const prefix = `STP${fullYear % 100}`;      // STP26

  // Find counter for the current year, increment seq, create if not exists
  const counter = await EmployeeCounter.findOneAndUpdate(
    { year: fullYear },
    { $inc: { seq: 1 }, $setOnInsert: { year: fullYear } },
    { new: true, upsert: true }  // return the updated/new doc
  );

  // Pad seq to 2 or 3 digits (e.g., 01, 02, 07)
  return `${prefix}${String(counter.seq).padStart(2, "0")}`;
}



router.get("/export/excel/all-employees", async (req, res) => {
  try {
    const { status = "all", from, to } = req.query;

    const query =
      status === "all"
        ? {}
        : { status };

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


module.exports = router;
