const Resignation = require("../models/resignation.model");
const Intern = require("../models/Intern");
const { sendEmail, LOGO_URL } = require("../utilities/sendEmail");
const { getSignature } = require("../utilities/emailSignature");


// CREATE resignation
exports.createResignation = async (req, res) => {
  try {
    const { internId } = req.body;
    const existing = await Resignation.findOne({ internId });

    if (existing && existing.status !== "rejected") {
      return res.json({ success: false, message: "Off boarding already submitted" });
    }

    if (existing && existing.status === "rejected") {
      Object.assign(existing, { ...req.body, status: "pending", createdAt: new Date() });
      await existing.save();
      return res.json({ success: true, message: "Resignation resubmitted successfully", data: existing });
    }

    const data = new Resignation({ ...req.body, status: "pending" });
    await data.save();
    res.json({ success: true, message: "Resignation submitted successfully", data });
  } catch (error) {
    console.error("Resignation Error:", error);
    res.status(500).json({ success: false, message: "Server Error" });
  }
};

// CHECK if resignation exists for an intern
exports.checkResignation = async (req, res) => {
  try {
    const { internId } = req.params;
    const existing = await Resignation.findOne({ internId });

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
    const list = await Resignation.find().sort({ createdAt: -1 });
    res.json({ success: true, data: list });
  } catch (error) {
    res.status(500).json({ success: false, message: "Server Error" });
  }
};

// GET resignation by internId
exports.getResignationByInternId = async (req, res) => {
  try {
    const record = await Resignation.findOne({ internId: req.params.internId });
    if (!record) return res.json({ success: false, message: "No record found" });
    res.json({ success: true, data: record });
  } catch (error) {
    res.status(500).json({ success: false, message: "Server Error" });
  }
};

// GET pending resignations
exports.getPendingResignations = async (req, res) => {
  try {
    const pendingList = await Resignation.find({ status: "pending" }).sort({ createdAt: -1 });
    res.json({ success: true, data: pendingList });
  } catch (err) {
    console.error("Fetch Pending Resignations Error:", err);
    res.status(500).json({ success: false, message: "Server error", error: err.message });
  }
};

// ACCEPT / REJECT resignation
exports.updateResignationStatus = async (req, res) => {
  try {
    const { action, id } = req.params;
    

    const resignation = await Resignation.findById(id);
    if (!resignation) return res.status(404).json({ message: "Resignation not found" });

    const intern = await Intern.findOne({ internid: resignation.internId });
    if (!intern) return res.status(404).json({ message: "Intern not found" });

    const formattedName = intern.fullName
      .split(" ")
      .map((word) => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
      .join(" ");

    let attachments = [];
    if (req.files?.length) {
      req.files.forEach(f => attachments.push({ content: f.buffer, filename: f.originalname }));
    }

    if (action === "accept") {
      resignation.status = "accepted";
      await resignation.save();

      intern.status = "drop";
      await intern.save();

      const lastDate = intern.endDate 
        ? new Date(intern.endDate).toLocaleDateString('en-IN', { day: 'numeric', month: 'long', year: 'numeric' }) 
        : "(TBD)";
      
      let certificateLine = "";
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

      await sendEmail({
        to: intern.email,
        subject: "Internship Offboarding Confirmed - PeopleSoft",
        html: `
          <div style="font-family: sans-serif; line-height: 1.5; color: #333;">
            <p style="margin: 0 0 10px 0;">Dear ${formattedName},</p>
            <p style="margin: 0 0 10px 0;">Thank you for submitting your offboarding form. We are pleased to confirm that your internship offboarding process has been successfully initiated and accepted by the HR team.</p>
            <p style="margin: 0 0 10px 0;">Your internship with Softrate Global officially concludes on <b>${lastDate}</b>. It has been a pleasure having you as part of our team, and we appreciate the effort and enthusiasm you have brought during your tenure.</p>
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

      return res.json({ message: "Resignation accepted and email sent" });

    } else if (action === "reject") {
      resignation.status = "rejected";
      await resignation.save();

      await sendEmail({
        to: intern.email,
        subject: "Internship Offboarding Form Rejected - PeopleSoft",
        html: `
          <div style="font-family: sans-serif; line-height: 1.5; color: #333;">
            <p style="margin: 0 0 10px 0;">Dear ${formattedName},</p>
            <p style="margin: 0 0 10px 0;">Thank you for submitting your internship offboarding form. After careful review, we regret to inform you that your form has been rejected. This could be due to pending formalities such as:</p>
            <ol style="padding-left: 20px; margin: 0 0 15px 0;">
              <li style="margin-bottom: 4px;">Return of all company-issued assets (ID card, access badge, equipment, etc.) is not completed.</li>
              <li style="margin-bottom: 4px;">Knowledge transfer and handover of pending tasks to your reporting manager is not completed.</li>
              <li style="margin-bottom: 4px;">Project documentation is not up to date or has not been shared with the team.</li>
              <li style="margin-bottom: 4px;">Outstanding approvals or submissions have not been cleared.</li>
            </ol>
            <p style="margin: 0 0 10px 0;">Kindly complete the above formalities and resubmit your offboarding form at the earliest.</p>
            <p style="margin: 0 0 15px 0;">For further details or assistance, please contact your HR at <a href="mailto:hr@softrateglobal.com" style="color: #007bb6;">hr@softrateglobal.com</a>.</p>
            ${getSignature(LOGO_URL)}
          </div>
        `
      });

      return res.json({ message: "Resignation rejected and email sent" });

    } else {
      return res.status(400).json({ message: "Invalid action" });
    }
  } catch (err) {
    console.error("Resignation Error:", err);
    res.status(500).json({ message: "Server error", error: err.message });
  }
};
