const express = require("express");
const router = express.Router();
const Holiday = require("../models/Holiday");

// ➕ Add holiday (HR only)
router.post("/", async (req, res) => {
  try {
    const { type, day, weeks, fromDate, toDate, reason } = req.body;

    if (type === "weekly" && day) {
      const newWeeks = Array.isArray(weeks) ? weeks : [];

      // CASE 1: DELETE ALL (empty weeks)
      if (newWeeks.length === 0) {
        const deleted = await Holiday.findOneAndDelete({ type: "weekly", day });
        if (deleted) {
          return res.status(200).json({ 
            message: `All weekly holidays for ${day} deleted`,
            deleted: true 
          });
        } else {
          return res.status(404).json({ message: `No holiday found for ${day}` });
        }
      }

      // CASE 2: REPLACE with new weeks selection
      // Delete existing holiday for this day
      await Holiday.findOneAndDelete({ type: "weekly", day });
      
      // Create NEW holiday with ONLY selected weeks
      const holiday = new Holiday({
        type: "weekly",
        day,
        weeks: newWeeks  // ONLY selected weeks [1,5]
      });
      
      await holiday.save();
      
      return res.status(201).json({ 
        message: "Weekly holidays updated", 
        holiday 
      });
    }

    // Special holiday logic (unchanged)
    if (type === "special" && fromDate && toDate && reason) {
      const from = new Date(fromDate);
      const to = new Date(toDate);
      
      const overlappingHoliday = await Holiday.findOne({
        type: "special",
        $or: [{ fromDate: { $lte: to }, toDate: { $gte: from } }]
      });

      if (overlappingHoliday) {
        return res.status(400).json({ 
          message: `Date range overlaps with existing holiday: ${overlappingHoliday.reason}` 
        });
      }

      const holiday = new Holiday({ type, fromDate: from, toDate: to, reason });
      await holiday.save();
      
      return res.status(201).json({ message: "Special holiday added", holiday });
    }

    res.status(400).json({ message: "Invalid data" });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});





// 📅 Get all holidays
router.get("/", async (req, res) => {
  try {
    const { year } = req.query;
    let query = {};

    if (year) {
      query = {
        $or: [
          { type: "weekly" },
          {
            type: "special",
            fromDate: { $lte: new Date(`${year}-12-31`) },
            toDate: { $gte: new Date(`${year}-01-01`) },
          },
        ],
      };
    }

    const holidays = await Holiday.find(query).sort({
      type: 1,
      fromDate: 1,
      day: 1,
    });

    res.json(holidays);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// ✏️ Update holiday
router.put("/:id", async (req, res) => {
  try {
    const holiday = await Holiday.findById(req.params.id);
    if (!holiday) {
      return res.status(404).json({ message: "Holiday not found" });
    }

    const { type, day, weeks, fromDate, toDate, reason } = req.body;

    if (type === "weekly") {
      if (day) holiday.day = day;
      if (weeks) holiday.weeks = weeks;
    } else if (type === "special") {
      if (fromDate) holiday.fromDate = new Date(fromDate);
      if (toDate) holiday.toDate = new Date(toDate);
      if (reason) holiday.reason = reason;
    }

    await holiday.save();
    res.json({ message: "Holiday updated", holiday });
  } catch (err) {
    res.status(400).json({ message: err.message });
  }
});

// ❌ Delete holiday
router.delete("/:id", async (req, res) => {
  try {
    const holiday = await Holiday.findByIdAndDelete(req.params.id);
    if (!holiday) {
      return res.status(404).json({ message: "Holiday not found" });
    }
    res.json({ message: "Holiday deleted" });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});
// ✅ CHECK IF TODAY IS HOLIDAY
router.get("/is-today-holiday", async (req, res) => {
  try {
    const today = new Date();
    today.setHours(0, 0, 0, 0); // Start of today
    const todayEnd = new Date(today);
    todayEnd.setHours(23, 59, 59, 999); // End of today

    // Check special holidays first
    const specialHoliday = await Holiday.findOne({
      type: "special",
      fromDate: { $lte: todayEnd },
      toDate: { $gte: today }
    });

    if (specialHoliday) {
      return res.json({ 
        isHoliday: true, 
        reason: specialHoliday.reason,
        type: "special"
      });
    }

    // Check weekly holidays
    const dayOfWeek = today.getDay(); // 0=Sun, 1=Mon, ...
    const dayNames = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
    const dayName = dayNames[dayOfWeek];

    const weekNum = Math.ceil(today.getDate() / 7); // 1st, 2nd, 3rd, 4th, 5th week
    const weeklyHoliday = await Holiday.findOne({
      type: "weekly",
      day: dayName,
      weeks: weekNum
    });

    if (weeklyHoliday) {
      return res.json({ 
        isHoliday: true, 
        reason: `${dayName} ${weeks[weekNum-1]} holiday`,
        type: "weekly"
      });
    }

    res.json({ isHoliday: false });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

module.exports = router;
