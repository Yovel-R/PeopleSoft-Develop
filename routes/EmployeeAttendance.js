const express = require("express");
const Attendance = require("../models/Employeeattendancemodel");
const PDFDocument = require("pdfkit");
const moment = require("moment");
const Employee = require("../models/EmployeeModel");
const ExcelJS = require("exceljs");
const Holiday = require("../models/Holiday"); // ✅ Add at TOP of file


const router = express.Router();

/* ======================
   📌 Punch In
====================== */

router.post("/punch-in", async (req, res) => {
  try {
    const { employeeId, location } = req.body;

    const today = new Date();
    today.setHours(0, 0, 0, 0); // Start of today
    const todayEnd = new Date(today);
    todayEnd.setHours(23, 59, 59, 999); // End of today
    const todayStr = today.toISOString().slice(0, 10);

    // ✅ 1. HOLIDAY CHECK - SPECIAL HOLIDAYS
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

    // ✅ 2. HOLIDAY CHECK - WEEKLY HOLIDAYS
    const dayOfWeek = today.getDay(); // 0=Sun, 1=Mon...
    const dayNames = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
    const dayName = dayNames[dayOfWeek];
    const weekNum = Math.ceil(today.getDate() / 7);

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

    // ✅ 3. EXISTING ATTENDANCE LOGIC
    let record = await Attendance.findOne({ employeeId, date: todayStr });

    if (record && record.punchInTime) {
      return res.status(400).json({ message: "Already punched in today." });
    }

    if (!record) {
      record = new Attendance({
        employeeId,
        date: todayStr,
      });
    }

    record.punchInTime = new Date();
    record.punchInLocation = location;
    await record.save();

    res.json({ message: "Punch In successful", record });
  } catch (err) {
    console.log(err);
    res.status(500).json({ message: "Server error" });
  }
});

/* ======================
   📌 Punch Out - WITH HOLIDAY CHECK
====================== */
router.post("/punch-out", async (req, res) => {
  try {
    const { employeeId, location } = req.body;

    // ✅ SAME HOLIDAY CHECK as punch-in
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const todayEnd = new Date(today);
    todayEnd.setHours(23, 59, 59, 999);
    const todayStr = today.toISOString().slice(0, 10);

    const specialHoliday = await Holiday.findOne({
      type: "special",
      fromDate: { $lte: todayEnd },
      toDate: { $gte: today }
    });

    if (specialHoliday) {
      return res.status(400).json({ 
        message: `Cannot punch out - Today is holiday: ${specialHoliday.reason}` 
      });
    }

    const dayOfWeek = today.getDay();
    const dayNames = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
    const dayName = dayNames[dayOfWeek];
    const weekNum = Math.ceil(today.getDate() / 7);

    const weeklyHoliday = await Holiday.findOne({
      type: "weekly",
      day: dayName,
      weeks: weekNum
    });

    if (weeklyHoliday) {
      return res.status(400).json({ 
        message: `Cannot punch out - ${dayName} ${weekNum}st week holiday` 
      });
    }

    // ✅ EXISTING PUNCH OUT LOGIC
    let record = await Attendance.findOne({ employeeId, date: todayStr });

    if (!record || !record.punchInTime) {
      return res.status(400).json({ message: "Punch-in not found for today" });
    }

    if (record.punchOutTime) {
      return res.status(400).json({ message: "Already punched out" });
    }

    record.punchOutTime = new Date();
    record.punchOutLocation = location;

    const diffMs = record.punchOutTime - record.punchInTime;
    const hours = Math.floor(diffMs / (1000 * 60 * 60));
    const minutes = Math.floor((diffMs % (1000 * 60 * 60)) / (1000 * 60));
    record.duration = `${hours.toString().padStart(2, "0")}:${minutes.toString().padStart(2, "0")}`;

    await record.save();
    res.json({ message: "Punch Out successful", record });
  } catch (err) {
    console.log(err);
    res.status(500).json({ message: "Server error" });
  }
});

/* ======================
   📌 Get Attendance by Employee ID
====================== */
router.get("/employee/:id", async (req, res) => {
  try {
    const employeeId = req.params.id;

    const attendance = await Attendance.find({ employeeId }).sort({
      date: -1,
    });

    res.json({ attendance });
  } catch (err) {
    console.log(err);
    res.status(500).json({ message: "Server error" });
  }
});

/* ======================
   📌 Get Today's Attendance
====================== */
router.get("/today/:employeeId", async (req, res) => {
  const { employeeId } = req.params;
  const today = new Date().toISOString().slice(0, 10);

  const record = await Attendance.findOne({ employeeId, date: today });

  console.log("Today employee attendance:", record);
  res.json({ record });
});



/* ======================
   📌 Export Attendance PDF
====================== */
router.get("/export/pdf/employee/:employeeId", async (req, res) => {
  try {
    const { employeeId } = req.params;
    const { from, to } = req.query;

    if (!from || !to) {
      return res.status(400).json({ message: "from & to dates required" });
    }

    const records = await Attendance.find({
      employeeId,
      date: {
        $gte: from,
        $lte: to,
      },
    }).sort({ date: 1 });

    res.setHeader("Content-Type", "application/pdf");
    res.setHeader(
      "Content-Disposition",
      `attachment; filename=attendance_${employeeId}.pdf`
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
      .text(`Employee ID : ${employeeId}`)
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

    /* ================= EMPTY STATE ================= */
    if (records.length === 0) {
      doc
        .moveDown(2)
        .fontSize(12)
        .fillColor("gray")
        .text("No attendance records found for selected date range.", {
          align: "center",
        });
    }

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





router.get("/export/excel/all", async (req, res) => {
  try {
    const { from, to } = req.query;
    if (!from || !to) {
      return res.status(400).json({ message: "from & to dates required" });
    }

    // ================= FETCH DATA =================
    const attendances = await Attendance.find({
      date: { $gte: from, $lte: to },
    })
      .sort({ employeeId: 1, date: 1 })
      .lean();

    // Unique Employee IDs from Attendance
    const employeeIds = [...new Set(attendances.map((a) => a.employeeId))];

    // Fetch Employee details with correct field names
    const employees = await Employee.find(
      { EmployeeId: { $in: employeeIds } }, // <- correct field
      { fullName: 1, EmployeeId: 1 }        // <- only fields we need
    ).lean();

    // Map EmployeeId to fullName
    const employeeMap = {};
    employees.forEach((e) => {
      employeeMap[e.EmployeeId] = e.fullName;
    });

    // ================= EXCEL SETUP =================
    const workbook = new ExcelJS.Workbook();
    const sheet = workbook.addWorksheet("Attendance Report");

    // Title
    sheet.mergeCells("A1:G1");
    sheet.getCell("A1").value = "All Employees Attendance Report";
    sheet.getCell("A1").alignment = { horizontal: "center" };
    sheet.getCell("A1").font = { size: 16, bold: true, color: { argb: "FF00657F" } };

    // Period
    sheet.mergeCells("A2:G2");
    sheet.getCell("A2").value = `Period : ${moment(from).format("DD MMM YYYY")} - ${moment(to).format("DD MMM YYYY")}`;
    sheet.getCell("A2").alignment = { horizontal: "center" };
    sheet.getCell("A2").font = { size: 12 };

    sheet.addRow([]);

    // Table columns
    sheet.columns = [
      { header: "Employee Name", key: "name", width: 25 },
      { header: "Employee ID", key: "id", width: 15 },
      { header: "Date", key: "date", width: 15 },
      { header: "Punch In", key: "in", width: 12 },
      { header: "Punch Out", key: "out", width: 12 },
      { header: "Hours", key: "hrs", width: 10 },
      { header: "Status", key: "status", width: 12 },
    ];

    // Fill rows
    for (const r of attendances) {
      const punchIn = r.punchInTime ? moment(r.punchInTime).format("hh:mm A") : "--";
      const punchOut = r.punchOutTime ? moment(r.punchOutTime).format("hh:mm A") : "--";

      let status = "Absent";
      if (r.punchInTime && r.punchOutTime) {
        const mins = (new Date(r.punchOutTime) - new Date(r.punchInTime)) / 60000;
        status = mins < 360 ? "Short" : "Present";
      }

      sheet.addRow({
        name: employeeMap[r.employeeId] || "-", // <- will now map correctly
        id: r.employeeId,
        date: moment(r.date).format("DD MMM YYYY"),
        in: punchIn,
        out: punchOut,
        hrs: r.duration || "--",
        status,
      });
    }

    // Empty attendance case
    if (attendances.length === 0) {
      sheet.addRow([]);
      const emptyRow = sheet.addRow(["No attendance records found."]);
      emptyRow.getCell(1).font = { italic: true, color: { argb: "FF808080" } };
    }

    // Footer
    sheet.addRow([]);
    const footerRow = sheet.addRow(["Generated by SoftPeople HRM"]);
    footerRow.getCell(1).alignment = { horizontal: "center" };
    footerRow.font = { italic: true, color: { argb: "FF808080" } };

    // ================= SEND EXCEL =================
    res.setHeader(
      "Content-Disposition",
      `attachment; filename=attendance_${moment(from).format("DDMMYY")}_${moment(to).format("DDMMYY")}.xlsx`
    );
    res.setHeader("Content-Type", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet");

    await workbook.xlsx.write(res);
    res.end();
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Excel export failed" });
  }
});

router.get("/employee/today/all", async (req, res) => {
  try {
    const today = new Date().toLocaleDateString("en-CA", {
      timeZone: "Asia/Kolkata",
    });

    const attendanceData = await Employee.aggregate([
      {
        $match: { status: { $ne: "inactive" } },
      },
      {
        $lookup: {
          from: "employeeattendances", 
          let: { employeeId: "$EmployeeId" }, 
          pipeline: [
            {
              $match: {
                $expr: { $eq: ["$employeeId", "$$employeeId"] },
                date: today,
              },
            },
          ],
          as: "attendance",
        },
      },
      {
        $unwind: {
          path: "$attendance",
          preserveNullAndEmptyArrays: true,
        },
      },
      {
        $project: {
          employeeId: "$EmployeeId",
          name: {
            $concat: [
              { $toUpper: { $substrCP: ["$fullName", 0, 1] } },
              {
                $substrCP: ["$fullName", 1, { $strLenCP: "$fullName" }],
              },
            ],
          },
          phone: 1,
          punchInTime: "$attendance.punchInTime",
          punchOutTime: "$attendance.punchOutTime",
          duration: { $ifNull: ["$attendance.duration", "--"] },
        },
      },
      {
        $sort: { punchInTime: -1 }, // ✅ Present first
      },
    ]);

    res.json({
      date: today,
      count: attendanceData.filter((a) => a.punchInTime).length,
      attendance: attendanceData,
    });
  } catch (err) {
    console.error("Error in /employee/today/all:", err);
    res.status(500).json({ message: "Server error" });
  }
});



module.exports = router;
