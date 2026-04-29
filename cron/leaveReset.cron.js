const cron = require("node-cron");
const LeaveCounter = require("../models/leaveCounter.model");

cron.schedule(
  "5 0 * * *", // 12:12 AM IST
  async () => {
    console.log("🕛 Running Leave Reset Cron at 12:12 AM IST");

    const now = new Date(); // current time (IMPORTANT)

    try {
      const countersToReset = await LeaveCounter.find({
        nextResetDate: { $lte: now },
      });

      for (const counter of countersToReset) {
        // ❌ Do not auto-reset maternity leave
        if (counter.leaveType === "Maternity Leave") continue;

        const newCycleStartDate = new Date(counter.nextResetDate);
        newCycleStartDate.setHours(0, 0, 0, 0);

        const newNextResetDate = new Date(counter.nextResetDate);
        newNextResetDate.setFullYear(newNextResetDate.getFullYear() + 1);
        newNextResetDate.setHours(0, 0, 0, 0);

        counter.used = 0;
        counter.balance = counter.totalAllowed;
        counter.cycleStartDate = newCycleStartDate;
        counter.nextResetDate = newNextResetDate;

        await counter.save();

        console.log(
          `✅ ${counter.leaveType} reset for ${counter.employeeId}`
        );
      }
    } catch (error) {
      console.error("❌ Leave reset cron failed:", error);
    }
  },
  {
    timezone: "Asia/Kolkata",
  }
);
