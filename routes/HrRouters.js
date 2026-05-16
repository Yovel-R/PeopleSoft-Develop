// routes/HrRouters.js
const express = require("express");
const router = express.Router();
const { hrSignup, savePolicyUrl, getPolicyUrl, getPolicyForInterns} =
  require("../controllers/HrLoginController");
const verifyTenant = require("../middleware/tenant.middleware");

router.post("/signup", hrSignup);
// Unified login is now handled in auth.routes.js
router.post("/policy/save", verifyTenant, savePolicyUrl);
router.get("/policy", verifyTenant, getPolicyUrl);
router.get("/policy-only", verifyTenant, getPolicyForInterns);


module.exports = router;
