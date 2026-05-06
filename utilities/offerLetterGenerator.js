const PDFDocument = require('pdfkit');
const fs = require('fs');
const path = require('path');
const moment = require('moment');

/**
 * Generates an offer letter PDF buffer based on intern data.
 */
async function generateOfferLetter(internData) {
    console.log("Generating Offer Letter for:", internData.fullName);
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

            // Assets paths
            const assetsDir = path.join(__dirname, '../assets');
            const logoPath = path.join(assetsDir, 'images/pdf_logo.png');
            const sigPath = path.join(assetsDir, 'images/signature.png');
            const qrPath = path.join(assetsDir, 'images/qr.png');
            const fontPath = path.join(assetsDir, 'fonts/TimesNewRoman.ttf');
            const boldFontPath = path.join(assetsDir, 'fonts/TimesNewRomanBold.ttf');

            // Verification
            if (!fs.existsSync(fontPath)) console.warn("Warning: Regular font missing at", fontPath);
            if (!fs.existsSync(boldFontPath)) console.warn("Warning: Bold font missing at", boldFontPath);

            // Draw outer border
            const margin = 20;
            doc.rect(margin, margin, doc.page.width - 2 * margin, doc.page.height - 2 * margin)
               .lineWidth(2)
               .stroke('#A0BBB5');

            // Content padding
            const padding = 44;
            let y = padding;

            // HEADER
            if (fs.existsSync(logoPath)) {
                doc.image(logoPath, padding, y, { height: 80 });
            }

            // Company Details
            if (fs.existsSync(boldFontPath)) doc.font(boldFontPath);
            doc.fontSize(16).fillColor('#000000');
            const companyName = 'S o f t r a t e   T e c h n o l o g i e s   ( P )   L t d';
            const companyNameWidth = doc.widthOfString(companyName);
            doc.text(companyName, doc.page.width - padding - companyNameWidth, y + 15);

            y += 40;
            if (fs.existsSync(fontPath)) doc.font(fontPath);
            doc.fontSize(9).fillColor('#333333');
            const address = 'SOFTRATE TECH PARK, MANGADU, CHENNAI, INDIA, 600 122';
            doc.text(address, doc.page.width - padding - doc.widthOfString(address), y);
            
            y += 12;
            const contact = '(+91) 8148633580 | hr@softrateglobal.com';
            doc.text(contact, doc.page.width - padding - doc.widthOfString(contact), y);

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

            // BODY
            doc.text('We are pleased to offer you an Internship opportunity as a ', { continued: true });
            if (fs.existsSync(boldFontPath)) doc.font(boldFontPath);
            doc.text(`${internData.role || 'Intern'}`, { continued: true });
            if (fs.existsSync(fontPath)) doc.font(fontPath);
            doc.text(' at Softrate Technologies Pvt Ltd (Chennai Office).');

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

            const welcomeText = 'We at Softrate are delighted to welcome you on board. During your internship, our focus will be on providing you with practical, hands-on experience that will enhance your understanding of real-world applications and prepare you for on-field challenges.';
            doc.text(welcomeText, padding, y, { align: 'justify', width: doc.page.width - 2 * padding });

            y = doc.y + 20;

            const congratulations = 'Congratulations once again, and welcome to the team! We are confident that your contributions will play an important role in helping us achieve our mission and goals.';
            doc.text(congratulations, padding, y, { align: 'justify', width: doc.page.width - 2 * padding });

            y = doc.y + 20;

            doc.text('Your Appointment with us will be governed by the Special Terms and Conditions discussed in the Annexure.');

            y = doc.y + 20;

            if (fs.existsSync(boldFontPath)) doc.font(boldFontPath);
            doc.text('Work location: Softrate Tech Park, Chennai');

            y += 60;

            // SIGNATURE & QR
            const sigY = y;
            if (fs.existsSync(boldFontPath)) doc.font(boldFontPath);
            doc.text('Kudos,', padding, sigY);
            
            if (fs.existsSync(sigPath)) {
                doc.image(sigPath, padding, sigY + 15, { height: 40 });
            }
            
            if (fs.existsSync(fontPath)) doc.font(fontPath);
            doc.fontSize(11).text('Hiring Manager\nSoftrate Global (India)', padding, sigY + 65);

            // QR Code
            if (fs.existsSync(qrPath)) {
                doc.image(qrPath, doc.page.width - padding - 120, sigY - 20, { height: 120 });
            }

            // FOOTER
            if (fs.existsSync(boldFontPath)) doc.font(boldFontPath);
            doc.fontSize(12).fillColor('#A0BBB5');
            const website = 'www.softrateglobal.com';
            doc.text(website, 0, doc.page.height - padding - 20, { align: 'center', width: doc.page.width });

            doc.end();
        } catch (err) {
            console.error("Generator Internal Error:", err);
            reject(err);
        }
    });
}

module.exports = { generateOfferLetter };
