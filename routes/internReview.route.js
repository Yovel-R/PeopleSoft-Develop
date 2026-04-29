const express = require("express");
const router = express.Router();
const Review = require("../models/internReview.model");

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

/* ---------------- SUBMIT SELF REVIEW ---------------- */
// POST /api/reviews/submit-review

router.post("/submit-review", async (req, res) => {
  try {
    const { internId, internName, team, goals } = req.body;

    if (!internId || !internName || !team || !Array.isArray(goals)) {
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

    const existing = await Review.findOne({
      internId,
      date: { $regex: `^${monthStr}` }
    });

    if (existing) {
      return res.status(400).json({
        success: false,
        message: "Review already submitted for this month"
      });
    }

    const review = new Review({
      internId,
      internName,
      team,
      goals,
      date: dateStr,
      isGraded: false,
      summary: {
        obtainedScore: 0,
        totalWeight: 0,
        percentage: 0
      },
      overallPercentage: 0
    });

    await review.save();

    return res.json({
      success: true,
      message: "Review submitted successfully",
      data: review
    });
  } catch (err) {
    console.error("Submit Review Error:", err);
    return res.status(500).json({
      success: false,
      message: "Failed to submit review"
    });
  }
});

/* ---------------- GET CURRENT MONTH SELF REVIEW ---------------- */
// GET /api/reviews/self/:internId

router.get("/self/:internId", async (req, res) => {
  try {
    const { internId } = req.params;

    const now = new Date();
    if (now.getDate() <= 5) {
      now.setMonth(now.getMonth() - 1);
    }
    const monthStr = `${now.getFullYear()}-${String(
      now.getMonth() + 1
    ).padStart(2, "0")}`;

    const review = await Review.findOne({
      internId,
      date: { $regex: `^${monthStr}` }
    })
      .sort({ date: -1 })
      .lean();

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
    console.error("Fetch Self Review Error:", err);
    return res.status(500).json({
      success: false,
      message: "Failed to fetch self review"
    });
  }
});

/* ---------------- GET REVIEW (HR VIEW) ---------------- */
// GET /api/reviews/:internId?month=2025-12

router.get("/:internId", async (req, res) => {
  try {
    const { internId } = req.params;
    const { month } = req.query;

    const query = { internId };
    if (month) query.date = { $regex: `^${month}` };

    const review = await Review.findOne(query)
      .sort({ date: -1 })
      .lean();

    if (!review) {
      return res.status(404).json({
        success: false,
        message: "Review not found"
      });
    }

    return res.json({
      success: true,
      data: review
    });
  } catch (err) {
    console.error("Fetch Review Error:", err);
    return res.status(500).json({
      success: false,
      message: "Failed to fetch review"
    });
  }
});

/* ---------------- GRADE REVIEW (HR) ---------------- */
// PUT /api/reviews/:internId/grade?month=2025-12

router.put("/:internId/grade", async (req, res) => {
  try {
    const { internId } = req.params;
    const { month } = req.query;
    const { goals } = req.body;

    if (!month || !Array.isArray(goals)) {
      return res.status(400).json({
        message: "Month and goals are required"
      });
    }

    const review = await Review.findOne({
      internId,
      date: { $regex: `^${month}` }
    });

    if (!review) {
      return res.status(404).json({
        message: "Review not found"
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

    const finalPercentage = Number(percentage.toFixed(2));

    review.summary = {
      obtainedScore,
      totalWeight,
      percentage: finalPercentage
    };

    review.overallPercentage = finalPercentage;
    review.isGraded = true;

    await review.save();

    return res.json({
      success: true,
      message: "Review graded successfully",
      data: review
    });
  } catch (err) {
    console.error("Grade Review Error:", err);
    return res.status(500).json({
      message: "Server error"
    });
  }
});

/* ---------------- EXPORT ---------------- */

module.exports = router;
