// routes/HrRouters.js
const express = require("express");
const router = express.Router();
const { hrSignup, savePolicyUrl, getPolicyUrl, getPolicyForInterns} =
  require("../controllers/HrLoginController");

router.post("/signup", hrSignup);
// Unified login is now handled in auth.routes.js
router.post("/policy/save", savePolicyUrl);
router.get("/policy", getPolicyUrl);
router.get("/policy-only", getPolicyForInterns);


module.exports = router;
