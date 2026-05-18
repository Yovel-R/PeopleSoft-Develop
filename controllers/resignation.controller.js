const Resignation = require("../models/resignation.model");
const Intern = require("../models/Intern");
const Employee = require("../models/EmployeeModel");
const { sendEmail, LOGO_URL } = require("../utilities/sendEmail");
const { getSignature } = require("../utilities/emailSignature");

const findUser = async (userId, userType) => {
  if (userType === "employee") {
    return await Employee.findOne({ EmployeeId: userId });
  }
  return await Intern.findOne({ internid: userId });
};

// CREATE resignation
exports.createResignation = async (req, res) => {
  try {
    const { userId, userType = "intern" } = req.body;
    console.log(`📝 Attempting to create resignation for ${userType}: ${userId}`);
    
    const user = await findUser(userId, userType);
    if (!user) {
      return res.status(404).json({ success: false, message: `${userType === 'employee' ? 'Employee' : 'Intern'} not found` });
    }

    const existing = await Resignation.findOne({ userId });

    if (existing && existing.status !== "rejected") {
      return res.json({ success: false, message: "Off boarding already submitted" });
    }

    const resignationData = {
      ...req.body,
      companyId: req.tenant.companyId,
      status: "pending_manager",
      managerStatus: "pending",
      hrStatus: "pending",
      managerId: user.assignedManager,
      fullName: user.fullName,
      createdAt: new Date()
    };

    if (existing && existing.status === "rejected") {
      Object.assign(existing, resignationData);
      await existing.save();

      // Trigger Real-Time Dashboard/Approvals Update
      const io = req.app.get('io');
      if (io) {
        io.emit('activity-updated', { type: 'new_resignation', resignation: existing });
      }

      return res.json({ success: true, message: "Resignation resubmitted successfully", data: existing });
    }

    const data = new Resignation(resignationData);
    await data.save();

    // Trigger Real-Time Dashboard/Approvals Update
    const io = req.app.get('io');
    if (io) {
      io.emit('activity-updated', { type: 'new_resignation', resignation: data });
    }

    res.json({ success: true, message: "Resignation submitted successfully", data });
  } catch (error) {
    console.error("Resignation Error:", error);
    res.status(500).json({ success: false, message: "Server Error" });
  }
};

// CHECK if resignation exists
exports.checkResignation = async (req, res) => {
  try {
    const { userId } = req.params;
    const existing = await Resignation.findOne({ userId });

    res.json({
      exists: !!existing && existing.status !== "rejected",
      status: existing?.status || null,
    });
  } catch (error) {
    res.status(500).json({ exists: false });
  }
};

// GET all resignations
exports.getAllResignations = async (req, res) => {
  try {
    const list = await Resignation.find({ companyId: req.tenant.companyId }).sort({ createdAt: -1 });
    res.json({ success: true, data: list });
  } catch (error) {
    res.status(500).json({ success: false, message: "Server Error" });
  }
};

// GET resignation by userId
exports.getResignationByUserId = async (req, res) => {
  try {
    const record = await Resignation.findOne({ userId: req.params.userId, companyId: req.tenant.companyId });
    if (!record) return res.json({ success: false, message: "No record found" });
    res.json({ success: true, data: record });
  } catch (error) {
    res.status(500).json({ success: false, message: "Server Error" });
  }
};

// GET pending resignations for HR
exports.getPendingResignations = async (req, res) => {
  try {
    const pendingList = await Resignation.find({ status: "pending_hr", companyId: req.tenant.companyId }).sort({ createdAt: -1 });
    res.json({ success: true, data: pendingList });
  } catch (err) {
    console.error("Fetch Pending Resignations Error:", err);
    res.status(500).json({ success: false, message: "Server error", error: err.message });
  }
};

// GET manager pending resignations
exports.getManagerPendingResignations = async (req, res) => {
  try {
    const { managerId } = req.params;
    const list = await Resignation.find({ managerId, status: "pending_manager", companyId: req.tenant.companyId }).sort({ createdAt: -1 });
    res.json({ success: true, data: list });
  } catch (err) {
    res.status(500).json({ success: false, message: "Server Error" });
  }
};

// MANAGER REVIEW
exports.managerReview = async (req, res) => {
  try {
    const { id } = req.params;
    const { status, remarks } = req.body;

    const resignation = await Resignation.findById(id);
    if (!resignation) return res.status(404).json({ message: "Resignation not found" });

    if (status === "approved") {
      resignation.managerStatus = "approved";
      resignation.managerRemarks = remarks;
      resignation.status = "pending_hr";
    } else {
      resignation.managerStatus = "rejected";
      resignation.managerRemarks = remarks;
      resignation.status = "rejected";
    }

    await resignation.save();
    res.json({ success: true, message: `Resignation ${status} by manager`, data: resignation });
  } catch (error) {
    res.status(500).json({ success: false, message: "Server Error" });
  }
};

// HR REVIEW
exports.hrReview = async (req, res) => {
  try {
    const { action, id } = req.params;
    const { remarks } = req.body;

    const resignation = await Resignation.findById(id);
    if (!resignation) return res.status(404).json({ message: "Resignation not found" });

    const user = await findUser(resignation.userId, resignation.userType);
    if (!user) return res.status(404).json({ message: "User not found" });

    const formattedName = user.fullName
      .split(" ")
      .map((word) => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
      .join(" ");

    let attachments = [];
    if (req.files?.length) {
      req.files.forEach(f => attachments.push({ content: f.buffer, filename: f.originalname }));
    }

    // Dynamic Certificate Generation from Flutter flags
    const { internship, project, lor, title } = req.body;
    if (resignation.userType === 'intern' && (internship || project || lor)) {
      const { generateDynamicPDF } = require("../utilities/certificateGenerator");
      const Company = require("../models/CompanyModel");
      
      const company = await Company.findById(resignation.companyId);
      const olSettings = company?.settings?.offerLetterSettings || company?.offerLetterSettings || {};
      
      const docData = {
        fullName: user.fullName,
        title: title || 'Mr.',
        internId: user.internid,
        onboardingDate: user.onboardingDate ? new Date(user.onboardingDate).toLocaleDateString('en-IN') : '',
        endDate: resignation.lastWorkingDay ? new Date(resignation.lastWorkingDay).toLocaleDateString('en-IN') : '',
        role: user.role,
        companyName: olSettings.companyName || 'Softrate Global',
        workLocation: olSettings.workLocation || 'Chennai',
      };

      if (internship && (olSettings.documentTemplates?.internshipCompletion?.pages?.length > 0 || olSettings.documentTemplates?.internshipCompletion?.backgroundUrl)) {
        try {
          const buffer = await generateDynamicPDF(docData, olSettings.documentTemplates.internshipCompletion);
          attachments.push({ filename: 'Internship_Certificate.pdf', content: buffer });
        } catch (e) { console.error("Failed to generate Internship Certificate:", e); }
      }
      if (project && (olSettings.documentTemplates?.projectCompletion?.pages?.length > 0 || olSettings.documentTemplates?.projectCompletion?.backgroundUrl)) {
        try {
          const buffer = await generateDynamicPDF(docData, olSettings.documentTemplates.projectCompletion);
          attachments.push({ filename: 'Project_Certificate.pdf', content: buffer });
        } catch (e) { console.error("Failed to generate Project Certificate:", e); }
      }
      if (lor && (olSettings.documentTemplates?.lor?.pages?.length > 0 || olSettings.documentTemplates?.lor?.backgroundUrl)) {
        try {
          const buffer = await generateDynamicPDF(docData, olSettings.documentTemplates.lor);
          attachments.push({ filename: 'LOR.pdf', content: buffer });
        } catch (e) { console.error("Failed to generate LOR:", e); }
      }
    }

    if (action === "accept") {
      resignation.status = "accepted";
      resignation.hrStatus = "approved";
      resignation.hrRemarks = remarks;
      await resignation.save();

      // Update user status
      user.status = "drop";
      await user.save();

      const lastDate = resignation.lastWorkingDay 
        ? new Date(resignation.lastWorkingDay).toLocaleDateString('en-IN', { day: 'numeric', month: 'long', year: 'numeric' }) 
        : "(TBD)";
      
      let certificateLine = "";
      if (resignation.userType === 'intern') {
        if (attachments.length > 0) {
          const nameMap = {
            "Internship_Certificate.pdf": "Internship Completion Certificate",
            "Project_Certificate.pdf": "Project Completion Certificate",
            "LOR.pdf": "Letter of Recommendation"
          };
          const professionalNames = attachments
            .map(a => nameMap[a.filename] || a.filename)
            .join(", ");
          certificateLine = `Please find your following documents attached for your records: ${professionalNames}.`;
        } else {
          certificateLine = "Your internship completion certificate and experience letter will be issued within 7 working days after the successful completion of all formalities.";
        }
      } else {
        certificateLine = "Your relieving letter and experience certificate will be issued within 7 working days after the successful completion of all formalities.";
      }

      await sendEmail({
        to: user.email,
        subject: `${resignation.userType === 'employee' ? 'Employee' : 'Internship'} Offboarding Confirmed - PeopleSoft`,
        html: `
          <div style="font-family: sans-serif; line-height: 1.5; color: #333;">
            <p style="margin: 0 0 10px 0;">Dear ${formattedName},</p>
            <p style="margin: 0 0 10px 0;">Thank you for submitting your offboarding form. We are pleased to confirm that your ${resignation.userType} offboarding process has been successfully initiated and accepted by the HR team.</p>
            <p style="margin: 0 0 10px 0;">Your tenure with Softrate Global officially concludes on <b>${lastDate}</b>. We appreciate the effort and dedication you have brought during your time with us.</p>
            <p style="margin: 0 0 10px 0;">As part of the offboarding process, please ensure the following are completed before your last day:</p>
            <ul style="padding-left: 20px; margin: 0 0 15px 0;">
              <li style="margin-bottom: 4px;">1. Return all company-issued assets (ID card, access badge, equipment, etc.)</li>
              <li style="margin-bottom: 4px;">2. Complete knowledge transfer and handover of pending tasks to your reporting manager</li>
              <li style="margin-bottom: 4px;">3. Ensure all project documentation is up to date and shared with the team</li>
              <li style="margin-bottom: 4px;">4. Clear any outstanding approvals or submissions</li>
            </ul>
            <p style="margin: 0 0 15px 0;">${certificateLine}</p>
            ${getSignature(LOGO_URL)}
          </div>
        `,
        attachments
      });

      return res.json({ message: "Offboarding accepted and email sent" });

    } else if (action === "reject") {
      resignation.status = "rejected";
      resignation.hrStatus = "rejected";
      resignation.hrRemarks = remarks;
      await resignation.save();

      await sendEmail({
        to: user.email,
        subject: `${resignation.userType === 'employee' ? 'Employee' : 'Internship'} Offboarding Form Rejected - PeopleSoft`,
        html: `
          <div style="font-family: sans-serif; line-height: 1.5; color: #333;">
            <p style="margin: 0 0 10px 0;">Dear ${formattedName},</p>
            <p style="margin: 0 0 10px 0;">Thank you for submitting your offboarding form. After careful review, we regret to inform you that your form has been rejected. This could be due to pending formalities such as:</p>
            <ol style="padding-left: 20px; margin: 0 0 15px 0;">
              <li style="margin-bottom: 4px;">Return of all company-issued assets is not completed.</li>
              <li style="margin-bottom: 4px;">Knowledge transfer and handover of pending tasks is not completed.</li>
              <li style="margin-bottom: 4px;">Project documentation is not up to date.</li>
              <li style="margin-bottom: 4px;">Outstanding approvals or submissions have not been cleared.</li>
            </ol>
            <p style="margin: 0 0 10px 0;">Kindly complete the above formalities and resubmit your offboarding form at the earliest.</p>
            <p style="margin: 0 0 15px 0;">For further details or assistance, please contact your HR at <a href="mailto:hr@softrateglobal.com" style="color: #007bb6;">hr@softrateglobal.com</a>.</p>
            ${getSignature(LOGO_URL)}
          </div>
        `
      });

      return res.json({ message: "Offboarding rejected and email sent" });

    } else {
      return res.status(400).json({ message: "Invalid action" });
    }
  } catch (err) {
    console.error("Resignation Error:", err);
    res.status(500).json({ message: "Server error", error: err.message });
  }
};
