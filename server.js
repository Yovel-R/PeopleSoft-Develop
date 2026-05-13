const express = require('express');
const cors = require('cors');
const mongoose = require('mongoose');
require('dotenv').config();
require("./cron/leaveReset.cron");


const app = express();
app.use(cors({ origin: '*' }));
app.use(express.json({ limit: '5mb' }));
app.use(express.urlencoded({ limit: '5mb', extended: true }));
app.use(express.static('public'));

// ============================
// MongoDB Atlas Connection
// ============================
const tenantPlugin = require('./plugins/tenant.plugin');
mongoose.plugin(tenantPlugin);

mongoose.connect(process.env.MONGO_URI)
  .then(() => console.log('✅ MongoDB Atlas connected'))
  .catch(err => console.error('❌ MongoDB error:', err));


// ============================
// Routes
// ============================
app.use('/api/hr', require('./routes/HrRouters'));
app.use('/api/intern', require('./routes/internRoutes'));
app.use('/api/auth', require('./routes/auth.routes'));
app.use('/api/attendance', require('./routes/attendanceroutes'));
app.use('/api/reviews', require('./routes/internReview.route'));
app.use('/api/leave', require('./routes/employeeLeave.routes'));
app.use('/api/resignation', require('./routes/resignation.routes'));
app.use('/api', require('./routes/send-documents'));
app.use('/api/employee', require('./routes/EmployeeRouter'));
app.use('/api/employeeAttanance', require('./routes/EmployeeAttendance'));
app.use("/api/employee-leave", require("./routes/employeeLeave.routes"));
app.use("/api/employee-reviews", require("./routes/employeeReview.routes"));
app.use("/api/employee-resignations", require("./routes/employee-resignation-routes"));
app.use('/api/employee-terminations', require('./routes/employeeTermination.routes'));
app.use('/api/leave-counter', require('./routes/leaveCounter.routes'));
app.use('/api/policy', require('./routes/policyRoutes'));
app.use("/api/holidays", require("./routes/holiday.routes"));
app.use("/api/assignments", require("./routes/assignment.routes"));
app.use("/api/attendance-requests", require("./routes/attendanceRequest.routes"));
app.use('/api/projects', require('./routes/project.routes'));
app.use('/api/onboarding', require('./routes/onboarding.routes'));
app.use('/api/settings', require('./routes/settings.routes'));

// ============================
// Test Route
// ============================
app.get('/', (req, res) => {
  res.send('HRM Backend is running');
});


// ============================
// Start Server
// ============================
const PORT = process.env.PORT || 5001;

app.listen(PORT, () => {
  console.log(`🚀 Server running on port ${PORT}`);
});

