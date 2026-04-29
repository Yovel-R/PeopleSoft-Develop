const express = require("express");
const Intern = require("../models/Intern");
const Resignation = require("../models/resignation.model.js");  
const router = express.Router();
const multer = require('multer');
const upload = multer();
const Counter = require("../models/counter.model");
const ExcelJS = require("exceljs");


router.post("/add", async (req, res) => {
  try {
    const {
      fullName,
      college,
      year,
      department,
      role,
      email,
      contact,
      emergencyContact,
      onboardingDate,
      endDate,
      linkedin,
      internshipType,
      applicationType,
      resume // Base64 PDF
    } = req.body;

    const intern = new Intern({
      fullName,
      college,
      year,
      department,
      role,
      email,
      contact,
      emergencyContact,
      onboardingDate,
      endDate,
      linkedin,
      internshipType,
      applicationType: applicationType || "Internship",
      status: "initial",
    });

    await intern.save();

    // Send Notification Email to HR with the Resume
    try {
      const attachments = [];
      if (resume) {
        // Remove data:application/pdf;base64, prefix if present
        const base64Data = resume.replace(/^data:application\/pdf;base64,/, "");
        attachments.push({
          filename: `Resume-${fullName.replace(/\s+/g, "_")}.pdf`,
          content: Buffer.from(base64Data, 'base64'),
        });
      }

      await sendEmail({
        to: process.env.RECIVER_EMAIL_USER,
        subject: `New ${applicationType || 'Internship'} Application: ${fullName}`,
        html: `
          <h3>New Application Received</h3>
          <p><strong>Application Type:</strong> ${applicationType || 'Internship'}</p>
          <p><strong>Full Name:</strong> ${fullName}</p>
          <p><strong>Role Applied For:</strong> ${role}</p>
          <p><strong>College:</strong> ${college}</p>
          <p><strong>Department:</strong> ${department}</p>
          <p><strong>Year:</strong> ${year}</p>
          <p><strong>Email:</strong> ${email}</p>
          <p><strong>Contact:</strong> ${contact}</p>
          <p><strong>LinkedIn:</strong> <a href="${linkedin}">${linkedin}</a></p>
          <br/>
          <p>The applicant's resume is attached to this email.</p>
          ${getSignature(LOGO_URL)}
        `,
        attachments: attachments,
      });
    } catch (emailErr) {
      console.error("Failed to send application notification email:", emailErr);
      // We don't fail the request if the email fails, since the data is saved
    }

    res.status(200).json({
      message: "Intern stored successfully",
      intern,
    });

  } catch (err) {
    console.error("Save Error:", err);
    res.status(500).json({ message: "Server error", error: err.message });
  }
});

// GET intern by internid
router.get("/all/initial", async (req, res) => {
  try {
    const interns = await Intern.find({ status: "initial" });
    res.json(interns);
  } catch (error) {
    console.error("Fetch Error:", error);
    res.status(500).json({ message: "Server Error" });
  }
});



// Get all approved or ongoing interns
// Get all approved or ongoing interns with filters
router.get("/all/active", async (req, res) => {
  try {
    const { range = "thisMonth", status = "all" } = req.query;

    const statusFilter =
      status === "all" ? ["approved", "ongoing", "remote"] : [status];

    const query = { status: { $in: statusFilter } };

    const now = new Date();
    let start, end;

    if (range === "thisMonth") {
      start = new Date(now.getFullYear(), now.getMonth(), 1);
      end = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59, 999);
    } else if (range === "sixMonths") {
      start = new Date(now.getFullYear(), now.getMonth() - 5, 1);
      end = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59, 999);
    }

    if (start && end) {
      query.createdAt = { $gte: start, $lte: end }; // <‑ use createdAt
    }

    const interns = await Intern.find(query).sort({ createdAt: -1 });
    res.json(interns);
  } catch (err) {
    console.error("Fetch Active Interns Error:", err);
    res.status(500).json({ message: "Server error", error: err.message });
  }
});





const { sendEmail, LOGO_URL } = require("../utilities/sendEmail");
const { getSignature } = require("../utilities/emailSignature");


router.put(
  "/accept/:id",
  upload.fields([
    { name: "pdf" },
    { name: "pdf_1" },
    { name: "pdf_2" },
  ]),
  async (req, res) => {
    try {
      const { onboardingDate, endDate, internshipType } = req.body;

      const intern = await Intern.findById(req.params.id);
      if (!intern) {
        return res.status(404).json({ message: "Intern not found" });
      }

      if (internshipType && !["Stipend", "Paid"].includes(internshipType)) {
        return res.status(400).json({ message: "Invalid internship type" });
      }

      const pdfBuffer  = req.files?.pdf?.[0]?.buffer;
      const pdf1Buffer = req.files?.pdf_1?.[0]?.buffer;
      const pdf2Buffer = req.files?.pdf_2?.[0]?.buffer;

      if (!pdfBuffer || !pdf1Buffer || !pdf2Buffer) {
        return res.status(400).json({ message: "All PDF files are required" });
      }

      const newId = await generateInternId();

      intern.internid = newId;
      intern.status = "approved";
      intern.onboardingDate = onboardingDate;
      intern.endDate = endDate;
      if (internshipType) intern.internshipType = internshipType;

      await intern.save();

      console.log("Intern saved successfully. Preparing to send email...");
      console.log("LOGO_URL:", LOGO_URL);
      console.log("Attachments presence - Offer:", !!pdfBuffer, "Annexure:", !!pdf1Buffer, "NDA:", !!pdf2Buffer);

      await sendEmail({
        to: intern.email,
        subject: "Internship Application – Approval Notification",
        html: `
          <p>Dear ${intern.fullName.split(' ').map(w => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase()).join(' ')},</p>
          <p>This is to inform you that your application has been reviewed and your profile has been approved for the internship program.</p>
          <p>Your internship details are as follows:</p>
          <ul>
            <li>Intern ID: ${newId}</li>
            <li>Onboarding Date: ${new Date(onboardingDate).toLocaleDateString("en-IN", { day: "numeric", month: "long", year: "numeric" })}</li>
            <li>End Date: ${new Date(endDate).toLocaleDateString("en-IN", { day: "numeric", month: "long", year: "numeric" })}</li>
          </ul>
          <p style="margin: 0 0 0 0;">To proceed further, please log in to the HRMS portal using the credentials shared separately.</p>
          <p style="margin: 0 0 0 0;">For first-time login, you will be required to set your own password and complete your profile by providing the necessary details.</p>
          <p style="margin: 0 0 0 0;">Kindly ensure that all required information is submitted before your onboarding date to avoid any delays.</p>
          <p style="margin: 0 0 15px 0;">For any queries, feel free to contact us.</p>
          ${getSignature(LOGO_URL)}
        `,
        attachments: [
          { filename: `${newId}-Offer-Letter.pdf`, content: pdfBuffer },
          { filename: `${newId}-Annexure.pdf`, content: pdf1Buffer },
          { filename: `${newId}-NDA.pdf`, content: pdf2Buffer },
        ],
      });

      res.json({ message: "Intern approved & email sent", intern });
    } catch (err) {
      console.error("Approve Error [FULL STACK]:", err.stack);
      console.error("Approve Error:", err);
      res.status(500).json({ message: "Server error", error: err.message, stack: err.stack });
    }
  }
);


router.delete("/reject/:id", async (req, res) => {
  try {
    const intern = await Intern.findByIdAndDelete(req.params.id);

    if (!intern) {
      return res.status(404).json({ message: "Intern not found" });
    }

    res.json({
      message: "Intern rejected and removed successfully",
      intern,
    });
  } catch (err) {
    console.error("Reject Delete Error:", err);
    res.status(500).json({ message: "Server error" });
  }
});



// id generator

async function generateInternId() {
  const year = (new Date().getFullYear() % 100).toString();

  let counter;
  let internId;

  do {
    counter = await Counter.findOneAndUpdate(
      { year },
      { $inc: { seq: 1 } },
      { new: true, upsert: true }
    );

    internId = `${year}${String(counter.seq).padStart(3, "0")}`;
  } while (await Intern.exists({ internid: internId }));

  return internId;
}



router.post("/login", async (req, res) => {
  const { internid, password } = req.body;

  const intern = await Intern.findOne({ internid });

  if (!intern) {
    return res.status(404).json({ message: "Intern not found" });
  }

  // First-time login
  if (intern.password === "") {
    intern.password = password; // No encryption
    await intern.save();
    return res.json({
      message: "Password set",
      firstTime: true,
      intern,
    });
  }

  // Normal login
  if (intern.password !== password) {
    return res.status(401).json({ message: "Wrong password" });
  }

  res.json({ message: "Login successful", firstTime: false, intern });
});



// Get intern by internid
router.get("/get/:internid", async (req, res) => {
  try {
    const internid = req.params.internid;
    const intern = await Intern.findOne({ internid });

    if (!intern) {
      return res.status(404).json({ message: "Intern not found" });
    }

    res.json({ intern });
  } catch (err) {
    console.error("Fetch Intern Error:", err);
    res.status(500).json({ message: "Server error", error: err.message });
  }
});

// changing approved to ongoing
router.post("/update-status", async (req, res) => {
  try {
    const { internId, status } = req.body;

    const intern = await Intern.findOneAndUpdate(
      { internid: internId },
      { status: status },
      { new: true }
    );

    if (!intern) {
      return res.status(404).json({ message: "Intern not found" });
    }

    res.status(200).json({
      message: "Status updated successfully",
      intern,
    });
  } catch (err) {
    console.error("Update Status Error:", err);
    res.status(500).json({ message: "Server error", error: err.message });
  }
});


router.get("/pastout", async (req, res) => {
  try {
    const year = parseInt(req.query.year);
    const month = parseInt(req.query.month); // 0 = all

    const resignations = await Resignation.find({ status: "accepted" });

    const filtered = resignations.filter((r) => {
      if (!r.lastWorkingDay) return false;

      const date = new Date(r.lastWorkingDay);
      if (isNaN(date)) return false;

      if (year && date.getFullYear() !== year) return false;
      if (month && month !== 0 && date.getMonth() + 1 !== month) return false;

      return true;
    });

    const internIds = filtered.map((r) => r.internId);

    const interns = await Intern.find({
      internid: { $in: internIds },
    });

    const result = filtered.map((r) => {
      const intern = interns.find((i) => i.internid === r.internId);

      return {
        internId: r.internId,
        fullName: intern?.fullName ?? r.internName,
        department: intern?.department ?? "",
        endDate: r.lastWorkingDay,
        status: "drop",
        exitType: r.exitType,
        exitReason: r.exitReason,
      };
    });

    res.status(200).json(result);
  } catch (err) {
    console.error("Past-out error:", err);
    res.status(500).json({ message: "Server error" });
  }
});


router.get("/export/excel", async (req, res) => {
  try {
    const { status = "all", from, to } = req.query;

    const query =
      status === "all"
        ? {}
        : { status };

    let interns = await Intern.find(query).sort({ createdAt: -1 });

    if (from && to) {
      const fromDate = new Date(from);
      const toDate = new Date(to);
      toDate.setHours(23, 59, 59, 999);

      interns = interns.filter((intern) => {
        if (!intern.onboardingDate) return false;
        const onboardDate = new Date(intern.onboardingDate);
        if (isNaN(onboardDate)) return false;
        return onboardDate >= fromDate && onboardDate <= toDate;
      });
    }

    const workbook = new ExcelJS.Workbook();
    const sheet = workbook.addWorksheet("Interns");

    sheet.columns = [
      { header: "Intern ID", key: "internid", width: 15 },
      { header: "Full Name", key: "fullName", width: 25 },
      { header: "Email", key: "email", width: 30 },
      { header: "Contact", key: "contact", width: 15 },
      { header: "College", key: "college", width: 25 },
      { header: "Year", key: "year", width: 10 },
      { header: "Department", key: "department", width: 20 },
      { header: "Role", key: "role", width: 20 },
      { header: "Internship Type", key: "internshipType", width: 18 },
      { header: "Status", key: "status", width: 15 },
      { header: "Onboarding Date", key: "onboardingDate", width: 18 },
      { header: "End Date", key: "endDate", width: 18 },
      { header: "Created At", key: "createdAt", width: 22 },
    ];

    interns.forEach((intern) => {
      sheet.addRow({
        internid: intern.internid || "",
        fullName: intern.fullName,
        email: intern.email,
        contact: intern.contact,
        college: intern.college,
        year: intern.year,
        department: intern.department,
        role: intern.role,
        internshipType: intern.internshipType || "",
        status: intern.status,
        onboardingDate: intern.onboardingDate || "",
        endDate: intern.endDate || "",
        createdAt: intern.createdAt
          ? new Date(intern.createdAt).toLocaleDateString("en-GB")
          : "",
      });
    });

    // Header style
    sheet.getRow(1).font = { bold: true };

    res.setHeader(
      "Content-Type",
      "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
    );
    res.setHeader(
      "Content-Disposition",
      "attachment; filename=Intern_Data.xlsx"
    );

    await workbook.xlsx.write(res);
    res.end();

  } catch (err) {
    console.error("Intern Excel Export Error:", err);
    res.status(500).json({ message: "Excel export failed" });
  }
});

module.exports = router;