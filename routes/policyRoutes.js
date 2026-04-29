const express = require("express");
const router = express.Router();
const Policy = require("../models/Policy");

/* GET ALL */
router.get("/all", async (req, res) => {
  const policies = await Policy.find().sort({ createdAt: -1 });
  res.json(policies);
});

/* BULK CREATE */
router.post("/bulk-add", async (req, res) => {
  const { policies } = req.body;
  await Policy.insertMany(policies);
  res.status(201).json({ message: "Policies added" });
});

/* BULK UPDATE */
router.put("/bulk-update", async (req, res) => {
  const { policies } = req.body;

  for (const p of policies) {
    await Policy.findByIdAndUpdate(p._id, {
      policy_name: p.policy_name,
      policy_url: p.policy_url,
      policy_view_by: p.policy_view_by,
    });
  }

  res.json({ message: "Policies updated" });
});

/* DELETE */
router.delete("/:id", async (req, res) => {
  await Policy.findByIdAndDelete(req.params.id);
  res.json({ message: "Policy deleted" });
});

module.exports = router;
