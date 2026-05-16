const ExcelJS = require("exceljs");
const express = require("express");
const mongoose = require("mongoose");
const verifyTenant = require("../middleware/tenant.middleware");
const Attendance = require("../models/attendancemodel");
const PDFDocument = require("pdfkit");
const moment = require("moment");
const Intern = require("../models/Intern");
const Employee = require("../models/EmployeeModel");
const Holiday = require("../models/Holiday"); 
const router = express.Router();

// 📌 Punch In

router.post("/punch-in", verifyTenant, async (req, res) => {
  try {
    const internId = req.body.internId || req.body.id || req.user.id;
    const { location } = req.body;

    const todayStr = new Date().toLocaleDateString("en-CA", { timeZone: "Asia/Kolkata" });
    const today = new Date(todayStr);
    const todayEnd = new Date(todayStr);
    todayEnd.setUTCHours(23, 59, 59, 999);

    // ✅ 1. CHECK HOLIDAY FIRST
    // Special holidays
    const specialHoliday = await Holiday.findOne({
      type: "special",
      fromDate: { $lte: todayEnd },
      toDate: { $gte: today }
    });

    if (specialHoliday) {
      return res.status(400).json({ 
        message: `Cannot punch in - Today is holiday: ${specialHoliday.reason}` 
      });
    }

    // Weekly holidays
    const dayOfWeek = today.getUTCDay(); // 0=Sun, 1=Mon...
    const dayNames = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
    const dayName = dayNames[dayOfWeek];
    const weekNum = Math.ceil(today.getUTCDate() / 7);

    const weeklyHoliday = await Holiday.findOne({
      type: "weekly",
      day: dayName,
      weeks: weekNum
    });

    if (weeklyHoliday) {
      return res.status(400).json({ 
        message: `Cannot punch in - ${dayName} ${weekNum}st week holiday` 
      });
    }

    // ✅ 2. Continue with existing logic
    let record = await Attendance.findOne({ internId, date: todayStr });

    if (record && record.punchInTime) {
      return res.status(400).json({ message: "Already punched in today." });
    }

    if (!record) {
      record = new Attendance({
        companyId: req.tenant.companyId,
        internId,
        date: todayStr,
      });
    }

    record.punchInTime = new Date();
    record.punchInLocation = location;

    await record.save();

    // Emit real-time event
    const io = req.app.get('io');
    io.emit('punch-event', { type: 'intern', action: 'punch-in', record });

    return res.json({ message: "Punch In successful", record });
  } catch (err) {
    console.log(err);
    return res.status(500).json({ message: "Server error" });
  }
});



// 📌 Punch Out
router.post("/punch-out", verifyTenant, async (req, res) => {
  try {
    const internId = req.body.internId || req.body.id || req.user.id;
    const { location } = req.body;

    const today = new Date().toLocaleDateString("en-CA", { timeZone: "Asia/Kolkata" });

    let record = await Attendance.findOne({ internId, date: today });

    if (!record || !record.punchInTime) {
      return res.status(400).json({ message: "Punch-in not found for today" });
    }

    if (record.punchOutTime) {
      return res.status(400).json({ message: "Already punched out" });
    }

    record.punchOutTime = new Date();
    record.punchOutLocation = location;

    // Calculate duration (HH:mm)
    const diffMs = record.punchOutTime - record.punchInTime;
    const hours = Math.floor(diffMs / (1000 * 60 * 60));
    const minutes = Math.floor((diffMs % (1000 * 60 * 60)) / (1000 * 60));

    record.duration = `${hours.toString().padStart(2, "0")}:${minutes
      .toString()
      .padStart(2, "0")}`;

    await record.save();

    // Emit real-time event
    const io = req.app.get('io');
    io.emit('punch-event', { type: 'intern', action: 'punch-out', record });

    return res.json({ message: "Punch Out successful", record });
  } catch (err) {
    console.log(err);
    return res.status(500).json({ message: "Server error" });
  }
});



// 📌 Get Attendance by Intern ID
router.get("/intern/:id", verifyTenant, async (req, res) => {
  try {
    const internId = req.params.id;
    const { year, month, from, to } = req.query;  // Add these params

    let query = { internId };
    
    if (year && month) {
      const start = new Date(parseInt(year), parseInt(month) - 1, 1);
      const end = new Date(parseInt(year), parseInt(month), 0);
      query.date = { $gte: start, $lte: end };
    } else if (from && to) {
      query.date = { $gte: new Date(from), $lte: new Date(to) };
    }

    const attendance = await Attendance.find(query).sort({ date: -1 });
    return res.json({ attendance });
  } catch (err) {
    console.log(err);
    return res.status(500).json({ message: "Server error" });
  }
});

router.get("/today/unified", verifyTenant, async (req, res) => {
  try {
    const today = new Date().toLocaleDateString("en-CA", { timeZone: "Asia/Kolkata" });
    const { managerId } = req.query;
    
    // Filter by company and optional manager
    const matchQuery = { companyId: req.tenant.companyId };
    if (managerId) {
      matchQuery.assignedManager = new mongoose.Types.ObjectId(managerId);
    }

    // 1. Fetch Interns with Attendance
    const interns = await Intern.aggregate([
      { $match: { ...matchQuery, status: { $nin: ["initial", "drop"] } } },
      {
        $lookup: {
          from: "attendances",
          let: { internId: "$internid" },
          pipeline: [
            { 
              $match: { 
                $expr: { $eq: ["$internId", "$$internId"] },
                date: today
              } 
            }
          ],
          as: "attendance"
        }
      },
      { $unwind: { path: "$attendance", preserveNullAndEmptyArrays: true } },
      {
        $project: {
          id: "$internid",
          name: "$fullName",
          type: { $literal: "Intern" },
          department: 1,
          punchInTime: "$attendance.punchInTime",
          punchOutTime: "$attendance.punchOutTime",
          punchInLocation: "$attendance.punchInLocation",
          punchOutLocation: "$attendance.punchOutLocation",
          duration: { $ifNull: ["$attendance.duration", "--"] },
          status: { $cond: [{ $ifNull: ["$attendance.punchInTime", false] }, "Present", "Absent"] }
        }
      }
    ]);

    // 2. Fetch Employees with Attendance
    const employees = await Employee.aggregate([
      { $match: matchQuery },
      {
        $lookup: {
          from: "employeeattendances",
          let: { empId: "$EmployeeId" },
          pipeline: [
            { 
              $match: { 
                $expr: { $eq: ["$employeeId", "$$empId"] },
                date: today
              } 
            }
          ],
          as: "attendance"
        }
      },
      { $unwind: { path: "$attendance", preserveNullAndEmptyArrays: true } },
      {
        $project: {
          id: "$EmployeeId",
          name: "$fullName",
          type: { $literal: "Employee" },
          department: 1,
          punchInTime: "$attendance.punchInTime",
          punchOutTime: "$attendance.punchOutTime",
          punchInLocation: "$attendance.punchInLocation",
          punchOutLocation: "$attendance.punchOutLocation",
          duration: { $ifNull: ["$attendance.duration", "--"] },
          status: { $cond: [{ $ifNull: ["$attendance.punchInTime", false] }, "Present", "Absent"] }
        }
      }
    ]);

    const combined = [...interns, ...employees].sort((a, b) => {
      if (a.status === b.status) return a.name.localeCompare(b.name);
      return a.status === "Present" ? -1 : 1;
    });

    res.json({
      date: today,
      count: combined.filter(a => a.status === "Present").length,
      attendance: combined
    });
  } catch (err) {
    console.error("Unified attendance error:", err);
    res.status(500).json({ message: "Server error" });
  }
});

router.get("/today/all", verifyTenant, async (req, res) => {
  // Existing logic kept for compatibility
  try {
    const today = new Date().toLocaleDateString("en-CA", { timeZone: "Asia/Kolkata" });
    const attendanceData = await Intern.aggregate([
      { $match: { status: { $nin: ["initial", "drop"] } } },
      {
        $lookup: {
          from: "attendances",
          let: { internId: "$internid" },
          pipeline: [
            { $match: { $expr: { $eq: ["$internId", "$$internId"] }, date: today, punchInTime: { $exists: true } } }
          ],
          as: "attendance"
        }
      },
      { $unwind: { path: "$attendance", preserveNullAndEmptyArrays: true } },
      {
        $project: {
          internId: "$internid",
          name: { $concat: [{ $toUpper: { $substrCP: ["$fullName", 0, 1] } }, { $substrCP: ["$fullName", 1, { $strLenCP: "$fullName" }] }] },
          contact: 1, 
          punchInTime: "$attendance.punchInTime",
          punchOutTime: "$attendance.punchOutTime",
          duration: { $ifNull: ["$attendance.duration", "--"] }
        }
      },
      { $sort: { punchInTime: 1 } }
    ]);
    res.json({ date: today, count: attendanceData.filter(a => a.punchInTime).length, attendance: attendanceData });
  } catch (err) { res.status(500).json({ message: "Server error" }); }
});




// 📌 Get Today's Attendance (FIXED)
router.get("/today/:internId", verifyTenant, async (req, res) => {
  let { internId } = req.params;
  if (internId === 'me' || !internId) {
    internId = req.user.id;
  }
  const today = new Date().toLocaleDateString("en-CA", { timeZone: "Asia/Kolkata" });
  const record = await Attendance.findOne({ internId, date: today });
  console.log("Today attendance record:", record);
  res.json({ record });
});

// 📌 Export Attendance Excel
router.get("/export/pdf/:internId", verifyTenant, async (req, res) => {
  try {
    const { internId } = req.params;
    const { from, to } = req.query;

    if (!from || !to) {
      return res.status(400).json({ message: "from & to dates required" });
    }

    // 1. Resolve Name and Custom ID
    console.log('Resolving ID for export:', internId);
    let intern = await Intern.findOne({ internid: internId });
    if (!intern && mongoose.Types.ObjectId.isValid(internId)) {
      intern = await Intern.findById(internId);
    }

    let employee = null;
    if (!intern) {
      const Employee = require("../models/EmployeeModel");
      employee = await Employee.findOne({ EmployeeId: internId });
      if (!employee && mongoose.Types.ObjectId.isValid(internId)) {
        employee = await Employee.findById(internId);
      }
    }

    const fullName = intern?.fullName || employee?.fullName || "N/A";
    const resolvedId = intern?.internid || employee?.EmployeeId || internId;
    console.log('Resolved Name:', fullName, 'Resolved ID:', resolvedId);

    // 2. Query Attendance using Resolved ID
    const records = await Attendance.find({
      internId: resolvedId,
      date: {
        $gte: from,
        $lte: to,
      },
    }).sort({ date: 1 });
    console.log('Records found:', records.length);

    res.setHeader("Content-Type", "application/pdf");
    res.setHeader(
      "Content-Disposition",
      `attachment; filename=attendance_${resolvedId}.pdf`
    );

    const doc = new PDFDocument({ margin: 40, size: "A4" });
    doc.pipe(res);

    /* ================= HEADER ================= */
    doc
      .fontSize(20)
      .fillColor("#00657F")
      .text("Attendance Report", { align: "center" });

    doc.moveDown(0.5);

    doc
      .fontSize(11)
      .fillColor("black")
      .text(`Name : ${fullName}`)
      .text(`ID : ${resolvedId}`)
      .text(
        `Period : ${moment(from).format("DD MMM YYYY")} - ${moment(to).format(
          "DD MMM YYYY"
        )}`
      );

    doc.moveDown(1);

    /* ================= TABLE HEADER ================= */
    const tableTop = doc.y;
    const col = {
      date: 40,
      in: 160,
      out: 270,
      duration: 380,
      status: 470,
    };

    doc.font("Helvetica-Bold").fontSize(11);
    doc.text("Date", col.date, tableTop);
    doc.text("Punch In", col.in, tableTop);
    doc.text("Punch Out", col.out, tableTop);
    doc.text("Hours", col.duration, tableTop);
    doc.text("Status", col.status, tableTop);

    doc.moveDown(0.5);
    doc.font("Helvetica");

    /* ================= TABLE ROWS ================= */
    records.forEach((r) => {
      const y = doc.y;

      let status = "Absent";
      if (r.punchInTime && r.punchOutTime) {
        const mins =
          (new Date(r.punchOutTime) - new Date(r.punchInTime)) / 60000;
        status = mins < 360 ? "Short" : "Present";
      }

      doc.text(moment(r.date).format("DD MMM YYYY"), col.date, y);
      doc.text(
        r.punchInTime
          ? moment(r.punchInTime).format("hh:mm A")
          : "--",
        col.in,
        y
      );
      doc.text(
        r.punchOutTime
          ? moment(r.punchOutTime).format("hh:mm A")
          : "--",
        col.out,
        y
      );
      doc.text(r.duration || "--", col.duration, y);
      doc.text(status, col.status, y);

      doc.moveDown(0.4);

      // Auto page break
      if (doc.y > 750) {
        doc.addPage();
      }
    });

    /* ================= FOOTER ================= */
    doc.moveDown(1);
    doc
      .fontSize(9)
      .fillColor("gray")
      .text("Generated by SoftPeople HRM", { align: "center" });

    doc.end();
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "PDF export failed" });
  }
});

router.get("/export/excel/all-interns", verifyTenant, async (req, res) => {
  try {
    const { from, to } = req.query;

    if (!from || !to) {
      return res.status(400).json({ message: "from & to dates required" });
    }

    // Attendance.date is STRING → string comparison
    const fromDateStr = from.split("T")[0]; // YYYY-MM-DD
    const toDateStr = to.split("T")[0];

    const records = await Attendance.find({
      date: { $gte: fromDateStr, $lte: toDateStr },
    })
      .sort({ internId: 1, date: 1 })
      .lean();

    if (!records.length) {
      return res
        .status(404)
        .json({ message: "No attendance records found for selected period." });
    }

    // Collect intern IDs
    const internIds = [...new Set(records.map(r => r.internId))];

    // Intern schema uses `internid`
    const interns = await Intern.find(
      { internid: { $in: internIds } },
      { internid: 1, fullName: 1 }
    ).lean();

    const internMap = {};
    interns.forEach(i => {
      internMap[i.internid] = i.fullName;
    });

    // Excel setup
    const workbook = new ExcelJS.Workbook();
    const sheet = workbook.addWorksheet("Attendance Report");

    // ===== HEADER =====
    sheet.mergeCells("A1:G1");
    sheet.getCell("A1").value = "All Interns Attendance Report";
    sheet.getCell("A1").alignment = { horizontal: "center" };
    sheet.getCell("A1").font = {
      size: 16,
      bold: true,
      color: { argb: "FF00657F" },
    };

    sheet.mergeCells("A2:G2");
    sheet.getCell("A2").value = `Period: ${moment(fromDateStr).format(
      "DD MMM YYYY"
    )} - ${moment(toDateStr).format("DD MMM YYYY")}`;
    sheet.getCell("A2").alignment = { horizontal: "center" };
    sheet.getCell("A2").font = { size: 12 };

    sheet.addRow([]);

    // ===== COLUMNS =====
    sheet.columns = [
      { header: "Intern Name", key: "name", width: 25 },
      { header: "Intern ID", key: "internId", width: 15 },
      { header: "Date", key: "date", width: 15 },
      { header: "Punch In", key: "punchIn", width: 12 },
      { header: "Punch Out", key: "punchOut", width: 12 },
      { header: "Hours", key: "duration", width: 12 },
      { header: "Status", key: "status", width: 12 },
    ];

    // 🔴 FORCE HEADER TITLES (fix for missing attributes)
    sheet.getRow(4).values = [
      "Intern Name",
      "Intern ID",
      "Date",
      "Punch In",
      "Punch Out",
      "Hours",
      "Status",
    ];
    sheet.getRow(4).font = { bold: true };

    // Freeze header & filter
    sheet.views = [{ state: "frozen", ySplit: 4 }];
    sheet.autoFilter = { from: "A4", to: "G4" };

    // ===== ROWS =====
    records.forEach(r => {
      let punchIn = "--";
      let punchOut = "--";
      let duration = "--";
      let status = "Absent";

      // Punch-in only → SHORT
      if (r.punchInTime) {
        punchIn = moment(r.punchInTime).format("hh:mm A");
        status = "Short";
      }

      if (r.punchOutTime) {
        punchOut = moment(r.punchOutTime).format("hh:mm A");
      }

      // Punch-in + Punch-out
      if (r.punchInTime && r.punchOutTime) {
        const mins =
          (new Date(r.punchOutTime) - new Date(r.punchInTime)) / 60000;

        const hrs = Math.floor(mins / 60);
        const rem = Math.round(mins % 60);
        duration = `${hrs}h ${rem}m`;

        status = mins < 360 ? "Short" : "Present";
      }

      sheet.addRow({
        name: internMap[r.internId] || "-",
        internId: r.internId,
        date: moment(r.date).format("DD MMM YYYY"),
        punchIn,
        punchOut,
        duration,
        status,
      });
    });

    // ===== FOOTER =====
    sheet.addRow([]);
    sheet.mergeCells(`A${sheet.rowCount}:G${sheet.rowCount}`);
    const footer = sheet.getRow(sheet.rowCount);
    footer.getCell(1).value = "Generated by SoftPeople HRM";
    footer.getCell(1).alignment = { horizontal: "center" };
    footer.getCell(1).font = { italic: true, color: { argb: "FF808080" } };

    // ===== SEND FILE =====
    res.setHeader(
      "Content-Disposition",
      `attachment; filename=All_Interns_Attendance_${moment(
        fromDateStr
      ).format("DDMMMyy")}_${moment(toDateStr).format("DDMMMyy")}.xlsx`
    );
    res.setHeader(
      "Content-Type",
      "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
    );

    await workbook.xlsx.write(res);
    res.end();
  } catch (err) {
    console.error("Excel export failed:", err);
    res.status(500).json({ message: "Excel export failed" });
  }
});

// 📌 Manual Update Attendance (HR only)
router.post("/update-manual", verifyTenant, async (req, res) => {
  try {
    const { internId, date, punchInTime, punchOutTime } = req.body;

    if (!internId || !date) {
      return res.status(400).json({ message: "internId and date are required" });
    }

    let record = await Attendance.findOne({ internId, date });
    if (!record) {
      record = new Attendance({ internId, date });
    }

    if (punchInTime !== undefined) {
      record.punchInTime = punchInTime ? new Date(punchInTime) : null;
    }
    if (punchOutTime !== undefined) {
      record.punchOutTime = punchOutTime ? new Date(punchOutTime) : null;
    }

    // Recalculate duration if both exist
    if (record.punchInTime && record.punchOutTime) {
      const diffMs = record.punchOutTime - record.punchInTime;
      const hours = Math.floor(diffMs / (1000 * 60 * 60));
      const minutes = Math.floor((diffMs % (1000 * 60 * 60)) / (1000 * 60));
      record.duration = `${hours.toString().padStart(2, "0")}:${minutes
        .toString()
        .padStart(2, "0")}`;
    } else {
      record.duration = null;
    }

    await record.save();
    return res.json({ message: "Attendance updated successfully", record });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ message: "Server error" });
  }
});

/* ======================
   📌 Get Attendance Trend (Last 7 Days)
====================== */
router.get("/trend", verifyTenant, async (req, res) => {
  try {
    const trend = [];
    for (let i = 6; i >= 0; i--) {
      const date = new Date();
      date.setDate(date.getDate() - i);
      const dateStr = date.toLocaleDateString("en-CA", { timeZone: "Asia/Kolkata" });
      
      const count = await Attendance.countDocuments({ date: dateStr, punchInTime: { $exists: true } });
      trend.push({
        date: dateStr,
        day: date.toLocaleDateString('en-US', { weekday: 'short' }).charAt(0),
        count
      });
    }
    res.json(trend);
  } catch (err) {
    res.status(500).json({ message: "Server error" });
  }
});

module.exports = router;
