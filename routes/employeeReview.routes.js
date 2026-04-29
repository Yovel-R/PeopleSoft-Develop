const express = require("express");
const router = express.Router();
const EmployeeReview = require("../models/employeeReview.model");

/* ---------------- UTIL ---------------- */

function scoreForGrade(grade, weight) {
  switch (grade) {
    case "A": return weight * 1;
    case "B": return weight * 0.75;
    case "C": return weight * 0.5;
    case "D": return weight * 0.25;
    default: return 0;
  }
}

/* =========================================================
   SUBMIT SELF REVIEW (EMPLOYEE)
   POST /api/employee-reviews/submit-review
========================================================= */

router.post("/submit-review", async (req, res) => {
  try {
    const { employeeId, employeeName, team, goals } = req.body;

    if (!employeeId || !employeeName || !team || !Array.isArray(goals)) {
      return res.status(400).json({
        success: false,
        message: "Invalid review payload"
      });
    }

    const today = new Date();
    if (today.getDate() <= 5) {
      today.setMonth(today.getMonth() - 1);
    }
    const dateStr = today.toISOString().split("T")[0];
    const monthStr = dateStr.slice(0, 7);

    const existing = await EmployeeReview.findOne({
      employeeId,
      date: { $regex: `^${monthStr}` }
    });

    if (existing) {
      return res.status(400).json({
        success: false,
        message: "Review already submitted for this month"
      });
    }

    const review = new EmployeeReview({
      employeeId,
      employeeName,
      team,
      goals,
      date: dateStr,
      isGraded: false,
      summary: {
        obtainedScore: 0,
        totalWeight: 0,
        percentage: 0
      }
    });

    await review.save();

    return res.json({
      success: true,
      message: "Employee review submitted successfully",
      data: review
    });
  } catch (err) {
    console.error("Submit Employee Review Error:", err);
    return res.status(500).json({
      success: false,
      message: "Failed to submit employee review"
    });
  }
});

/* =========================================================
   GET CURRENT MONTH SELF REVIEW (EMPLOYEE)
   GET /api/employee-reviews/self/:employeeId
========================================================= */

router.get("/self/:employeeId", async (req, res) => {
  try {
    const { employeeId } = req.params;

    const now = new Date();
    if (now.getDate() <= 5) {
      now.setMonth(now.getMonth() - 1);
    }
    const monthStr = `${now.getFullYear()}-${String(
      now.getMonth() + 1
    ).padStart(2, "0")}`;

    const review = await EmployeeReview.findOne({
      employeeId,
      date: { $regex: `^${monthStr}` }
    }).lean();

    if (!review) {
      return res.status(404).json({
        success: false,
        message: "Review not found for this month"
      });
    }

    return res.json({
      success: true,
      data: review
    });
  } catch (err) {
    console.error("Fetch Employee Review Error:", err);
    return res.status(500).json({
      success: false,
      message: "Failed to fetch employee review"
    });
  }
});

/* =========================================================
   GET REVIEW (HR / MANAGER VIEW)
   GET /api/employee-reviews/:employeeId?month=2025-12
========================================================= */

router.get("/:employeeId", async (req, res) => {
  try {
    const { employeeId } = req.params;
    const { month } = req.query;

    const query = { employeeId };
    if (month) query.date = { $regex: `^${month}` };

    const review = await EmployeeReview.findOne(query)
      .sort({ date: -1 })
      .lean();

    if (!review) {
      return res.status(404).json({
        success: false,
        message: "Employee review not found"
      });
    }

    return res.json({
      success: true,
      data: review
    });
  } catch (err) {
    console.error("Fetch Employee Review Error:", err);
    return res.status(500).json({
      success: false,
      message: "Failed to fetch employee review"
    });
  }
});

/* =========================================================
   GRADE REVIEW (MANAGER / HR)
   PUT /api/employee-reviews/:employeeId/grade?month=2025-12
========================================================= */

router.put("/:employeeId/grade", async (req, res) => {
  try {
    const { employeeId } = req.params;
    const { month } = req.query;
    const { goals } = req.body;

    if (!month || !Array.isArray(goals)) {
      return res.status(400).json({
        message: "Month and goals are required"
      });
    }

    const review = await EmployeeReview.findOne({
      employeeId,
      date: { $regex: `^${month}` }
    });

    if (!review) {
      return res.status(404).json({
        message: "Employee review not found"
      });
    }

    if (review.isGraded) {
      return res.status(400).json({
        message: "Review already graded"
      });
    }

    const totalWeight = review.goals.reduce(
      (sum, g) => sum + g.weight,
      0
    );

    let obtainedScore = 0;

    review.goals = review.goals.map(goal => {
      const incoming = goals.find(
        g => g._id === goal._id.toString()
      );

      if (!incoming || !incoming.grade) return goal;

      const score = scoreForGrade(incoming.grade, goal.weight);
      obtainedScore += score;

      return {
        ...goal.toObject(),
        grade: incoming.grade,
        score
      };
    });

    const percentage =
      totalWeight === 0 ? 0 : (obtainedScore / totalWeight) * 100;

    review.summary = {
      obtainedScore,
      totalWeight,
      percentage: Number(percentage.toFixed(2))
    };

    review.isGraded = true;
    await review.save();

    return res.json({
      success: true,
      message: "Employee review graded successfully",
      data: review
    });
  } catch (err) {
    console.error("Grade Employee Review Error:", err);
    return res.status(500).json({
      message: "Server error"
    });
  }
});

/* ---------------- EXPORT ---------------- */

module.exports = router;
