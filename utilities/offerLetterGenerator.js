const PDFDocument = require('pdfkit');
const fs = require('fs');
const path = require('path');
const moment = require('moment');
const axios = require('axios');
const { getAssetBuffer } = require('./assetHelper');

/**
 * Generates an offer letter PDF buffer based on intern data and company settings.
 */
async function generateOfferLetter(internData, companySettings = {}) {
    console.log("Generating Offer Letter for:", internData.fullName);

    // Merge company settings with defaults
    const settings = {
        companyName: 'Softrate Technologies (P) Ltd',
        address: 'SOFTRATE TECH PARK, MANGADU, CHENNAI, INDIA, 600 122',
        contact: '(+91) 8148633580 | hr@softrateglobal.com',
        website: 'www.softrateglobal.com',
        signatoryName: 'Hiring Manager',
        signatoryRole: 'Softrate Global (India)',
        workLocation: 'Softrate Tech Park, Chennai',
        logoUrl: null,
        signatureUrl: null,
        logoSize: 80,
        borderColor: '#A0BBB5',
        borderWidth: 2,
        ...companySettings
    };

    const assetsDir = path.join(__dirname, '../assets');
    const defaultLogoPath = path.join(assetsDir, 'images/pdf_logo.png');
    const defaultSigPath = path.join(assetsDir, 'images/signature.png');
    const qrPath = path.join(assetsDir, 'images/qr.png');
    const fontPath = path.join(assetsDir, 'fonts/TimesNewRoman.ttf');
    const boldFontPath = path.join(assetsDir, 'fonts/TimesNewRomanBold.ttf');

    // Prepare images (fetch remote if provided)
    let logoSource = fs.existsSync(defaultLogoPath) ? defaultLogoPath : null;
    if (settings.logoUrl) {
        const buf = await getAssetBuffer(settings.logoUrl);
        if (buf) logoSource = buf;
    }

    let sigSource = fs.existsSync(defaultSigPath) ? defaultSigPath : null;
    if (settings.signatureUrl) {
        const buf = await getAssetBuffer(settings.signatureUrl);
        if (buf) sigSource = buf;
    }

    return new Promise((resolve, reject) => {
        try {
            const doc = new PDFDocument({
                size: 'A4',
                margin: 40
            });

            const buffers = [];
            doc.on('data', buffers.push.bind(buffers));
            doc.on('end', () => {
                console.log("PDF generation completed successfully.");
                resolve(Buffer.concat(buffers));
            });
            doc.on('error', (err) => {
                console.error("PDFKit Error:", err);
                reject(err);
            });

            // Verification
            if (!fs.existsSync(fontPath)) console.warn("Warning: Regular font missing at", fontPath);
            if (!fs.existsSync(boldFontPath)) console.warn("Warning: Bold font missing at", boldFontPath);

            // Draw outer border
            const margin = 20;
            doc.rect(margin, margin, doc.page.width - 2 * margin, doc.page.height - 2 * margin)
               .lineWidth(settings.borderWidth)
               .stroke(settings.borderColor);

            // Content padding
            const padding = 44;
            let y = padding;

            // HEADER
            if (logoSource) {
                doc.image(logoSource, padding, y, { height: settings.logoSize });
            }

            // Company Details
            if (fs.existsSync(boldFontPath)) doc.font(boldFontPath);
            doc.fontSize(16).fillColor('#000000');
            const displayCompanyName = settings.companyName.split('').join('   '); // Maintain the spaced look
            const companyNameWidth = doc.widthOfString(displayCompanyName);
            doc.text(displayCompanyName, doc.page.width - padding - companyNameWidth, y + 15);

            y += 40;
            if (fs.existsSync(fontPath)) doc.font(fontPath);
            doc.fontSize(9).fillColor('#333333');
            doc.text(settings.address, doc.page.width - padding - doc.widthOfString(settings.address), y);
            
            y += 12;
            doc.text(settings.contact, doc.page.width - padding - doc.widthOfString(settings.contact), y);

            y += 60;

            // DATE
            if (fs.existsSync(boldFontPath)) doc.font(boldFontPath);
            doc.fontSize(12).fillColor('#000000');
            doc.text(moment().format("Do MMM, YYYY"), padding, y);

            y += 40;

            // SALUTATION
            if (fs.existsSync(fontPath)) doc.font(fontPath);
            doc.fontSize(12);
            doc.text(`Dear ${internData.fullName || 'Intern'},`, padding, y);

            y += 30;

            // CONTENT
            if (settings.templateContent) {
                let content = settings.templateContent
                    .replace(/{{fullName}}/g, internData.fullName)
                    .replace(/{{role}}/g, internData.role || 'Intern')
                    .replace(/{{companyName}}/g, settings.companyName)
                    .replace(/{{startDate}}/g, moment(internData.onboardingDate).format('DD.MM.YYYY'))
                    .replace(/{{endDate}}/g, moment(internData.endDate).format('DD.MM.YYYY'))
                    .replace(/{{workLocation}}/g, settings.workLocation);

                doc.text(content, padding, y, { align: 'justify', width: doc.page.width - 2 * padding });
            } else {
                // DEFAULT BODY
                doc.text('We are pleased to offer you an Internship opportunity as a ', { continued: true });
                if (fs.existsSync(boldFontPath)) doc.font(boldFontPath);
                doc.text(`${internData.role || 'Intern'}`, { continued: true });
                if (fs.existsSync(fontPath)) doc.font(fontPath);
                doc.text(` at ${settings.companyName} (Chennai Office).`);

                y = doc.y + 15;

                doc.text('Your Internship will be effective from ', { continued: true });
                if (fs.existsSync(boldFontPath)) doc.font(boldFontPath);
                doc.text(`${moment(internData.onboardingDate).format('DD.MM.YYYY')}`, { continued: true });
                if (fs.existsSync(fontPath)) doc.font(fontPath);
                doc.text(' and continue till ', { continued: true });
                if (fs.existsSync(boldFontPath)) doc.font(boldFontPath);
                doc.text(`${moment(internData.endDate).format('DD.MM.YYYY')}`, { continued: true });
                if (fs.existsSync(fontPath)) doc.font(fontPath);
                doc.text('.');

                y = doc.y + 20;

                const welcomeText = `We at ${settings.companyName.split(' ')[0]} are delighted to welcome you on board. During your internship, our focus will be on providing you with practical, hands-on experience that will enhance your understanding of real-world applications and prepare you for on-field challenges.`;
                doc.text(welcomeText, padding, y, { align: 'justify', width: doc.page.width - 2 * padding });

                y = doc.y + 20;

                const congratulations = 'Congratulations once again, and welcome to the team! We are confident that your contributions will play an important role in helping us achieve our mission and goals.';
                doc.text(congratulations, padding, y, { align: 'justify', width: doc.page.width - 2 * padding });

                y = doc.y + 20;

                doc.text('Your Appointment with us will be governed by the Special Terms and Conditions discussed in the Annexure.');

                y = doc.y + 20;

                if (fs.existsSync(boldFontPath)) doc.font(boldFontPath);
                doc.text(`Work location: ${settings.workLocation}`);
            }

            y = doc.y + 60;

            // SIGNATURE & QR
            const sigY = y;
            if (fs.existsSync(boldFontPath)) doc.font(boldFontPath);
            doc.text('Kudos,', padding, sigY);
            
            if (sigSource) {
                doc.image(sigSource, padding, sigY + 15, { height: 40 });
            }
            
            if (fs.existsSync(fontPath)) doc.font(fontPath);
            doc.fontSize(11).text(`${settings.signatoryName}\n${settings.signatoryRole}`, padding, sigY + 65);

            // QR Code
            if (fs.existsSync(qrPath)) {
                doc.image(qrPath, doc.page.width - padding - 120, sigY - 20, { height: 120 });
            }

            // FOOTER
            if (fs.existsSync(boldFontPath)) doc.font(boldFontPath);
            doc.fontSize(12).fillColor(settings.borderColor);
            const website = settings.website;
            doc.text(website, 0, doc.page.height - padding - 20, { align: 'center', width: doc.page.width });

            doc.end();
        } catch (err) {
            console.error("Generator Internal Error:", err);
            reject(err);
        }
    });
}

module.exports = { generateOfferLetter };
