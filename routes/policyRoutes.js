const express = require("express");
const router = express.Router();
const verifyTenant = require("../middleware/tenant.middleware");
const Policy = require("../models/Policy");

/* GET ALL */
router.get("/all", verifyTenant, async (req, res) => {
  const policies = await Policy.find().sort({ createdAt: -1 });
  res.json(policies);
});

/* CREATE SINGLE */
router.post("/add", verifyTenant, async (req, res) => {
  try {
    const policy = new Policy(req.body);
    await policy.save();
    res.status(201).json(policy);
  } catch (err) {
    res.status(400).json({ message: err.message });
  }
});

/* BULK CREATE */
router.post("/bulk-add", verifyTenant, async (req, res) => {
  const { policies } = req.body;
  await Policy.insertMany(policies);
  res.status(201).json({ message: "Policies added" });
});

/* BULK UPDATE */
router.put("/bulk-update", verifyTenant, async (req, res) => {
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
router.delete("/:id", verifyTenant, async (req, res) => {
  await Policy.findByIdAndDelete(req.params.id);
  res.json({ message: "Policy deleted" });
});

module.exports = router;
