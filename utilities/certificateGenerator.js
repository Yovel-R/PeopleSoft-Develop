const PDFDocument = require('pdfkit');
const fs = require('fs');
const path = require('path');
const { getAssetBuffer } = require('./assetHelper');

/**
 * Generates a certificate PDF by overlaying text on a background image.
 * @param {Object} data - Intern data (fullName, internId, etc)
 * @param {Object} template - { backgroundUrl, placeholders: [] }
 */
async function generateCertificate(data, template = {}) {
    const { backgroundUrl, placeholders = [] } = template;

    return new Promise(async (resolve, reject) => {
        try {
            const doc = new PDFDocument({
                size: 'A4',
                layout: 'landscape', // Certificates are usually landscape
                margin: 0
            });

            const buffers = [];
            doc.on('data', buffers.push.bind(buffers));
            doc.on('end', () => resolve(Buffer.concat(buffers)));

            // 1. Draw Background
            if (backgroundUrl) {
                const bgBuffer = await getAssetBuffer(backgroundUrl);
                if (bgBuffer) {
                    doc.image(bgBuffer, 0, 0, { width: 842, height: 595 }); // A4 Landscape
                }
            }

            const assetsDir = path.join(__dirname, '../assets');
            const fontPath = path.join(assetsDir, 'fonts/TimesNewRoman.ttf');
            const boldFontPath = path.join(assetsDir, 'fonts/TimesNewRomanBold.ttf');

            // 2. Draw Placeholders
            placeholders.forEach(p => {
                const text = data[p.key] || p.key;
                
                if (p.isBold && fs.existsSync(boldFontPath)) {
                    doc.font(boldFontPath);
                } else if (fs.existsSync(fontPath)) {
                    doc.font(fontPath);
                }

                doc.fontSize(p.fontSize || 12)
                   .fillColor(p.color || '#000000')
                   .text(text, p.x, p.y);
            });

            doc.end();
        } catch (err) {
            reject(err);
        }
    });
}

module.exports = { generateCertificate };
