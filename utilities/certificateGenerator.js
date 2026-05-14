const PDFDocument = require('pdfkit');
const fs = require('fs');
const path = require('path');
const { getAssetBuffer } = require('./assetHelper');
const moment = require('moment');

/**
 * Generates a multi-page PDF by overlaying text on background images.
 * @param {Object} data - Intern/Employee data
 * @param {Object} template - { orientation, pages: [{ backgroundUrl, placeholders }] }
 *                            Also supports legacy single-page: { backgroundUrl, placeholders }
 */
async function generateDynamicPDF(data, template = {}) {
    const orientation = template.orientation || 'portrait';

    // Normalize to pages array (backward compat with single backgroundUrl)
    let pages = template.pages;
    if (!pages || pages.length === 0) {
        pages = [{
            backgroundUrl: template.backgroundUrl || '',
            placeholders: template.placeholders || []
        }];
    }

    const assetsDir = path.join(__dirname, '../assets');
    const fontPath     = path.join(assetsDir, 'fonts/TimesNewRoman.ttf');
    const boldFontPath = path.join(assetsDir, 'fonts/TimesNewRomanBold.ttf');

    const width  = orientation === 'portrait' ? 595.28 : 841.89;
    const height = orientation === 'portrait' ? 841.89 : 595.28;

    return new Promise(async (resolve, reject) => {
        try {
            const doc = new PDFDocument({
                size: 'A4',
                layout: orientation,
                margin: 0,
                autoFirstPage: false  // We add pages manually
            });

            const buffers = [];
            doc.on('data', buffers.push.bind(buffers));
            doc.on('end', () => resolve(Buffer.concat(buffers)));

            for (let i = 0; i < pages.length; i++) {
                const page = pages[i];

                // Add a new page for each background
                doc.addPage({ size: 'A4', layout: orientation, margin: 0 });

                // 1. Draw background image
                if (page.backgroundUrl) {
                    const bgBuffer = await getAssetBuffer(page.backgroundUrl);
                    if (bgBuffer) {
                        doc.image(bgBuffer, 0, 0, { width, height });
                    }
                }

                // 2. Draw placeholders for this page
                const placeholders = page.placeholders || [];
                for (const p of placeholders) {
                    let text = data[p.key] || '';

                    // Format dates
                    if (p.key.toLowerCase().includes('date') && text) {
                        text = moment(text).format('DD MMM YYYY');
                    }

                    if (p.isBold && fs.existsSync(boldFontPath)) {
                        doc.font(boldFontPath);
                    } else if (fs.existsSync(fontPath)) {
                        doc.font(fontPath);
                    }

                    doc.fontSize(p.fontSize || 12)
                       .fillColor(p.color || '#000000')
                       .text(text, p.x, p.y);
                }
            }

            doc.end();
        } catch (err) {
            console.error('PDF Generation Error:', err);
            reject(err);
        }
    });
}

module.exports = { generateDynamicPDF };
