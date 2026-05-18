const PDFDocument = require('pdfkit');
const fs = require('fs');
const path = require('path');
const { getAssetBuffer } = require('./assetHelper');
const moment = require('moment');

/**
 * Helper to extract and replace placeholders inside a paragraph string
 */
function resolveParagraphText(text, data) {
    if (!text) return '';
    return text.replace(/\{\{([^}]+)\}\}/g, (match, key) => {
        let val = data[key.trim()] || '';
        if (key.toLowerCase().includes('date') && val) {
            val = moment(val).format('DD MMM YYYY');
        }
        return val;
    });
}

/**
 * Maps frontend font family choices to standard PDFKit fonts,
 * or loads custom fonts if they exist in the assets directory.
 */
function setPdfFont(doc, fontFamily, isBold, isItalic, assetsDir) {
    const boldPath = path.join(assetsDir, 'fonts/TimesNewRomanBold.ttf');
    const normalPath = path.join(assetsDir, 'fonts/TimesNewRoman.ttf');
    
    // Default fallback to custom TNR if it exists
    let defaultFont = fs.existsSync(normalPath) ? normalPath : 'Times-Roman';
    if (isBold && fs.existsSync(boldPath)) {
        defaultFont = boldPath;
    }

    if (!fontFamily || fontFamily === 'inherit') {
        doc.font(defaultFont);
        return;
    }
    
    const fontLower = fontFamily.toLowerCase();
    
    // 1. Great Vibes Calligraphy Script
    if (fontLower.includes('great vibes')) {
        const pathGV = path.join(assetsDir, 'fonts/GreatVibes-Regular.ttf');
        if (fs.existsSync(pathGV)) {
            doc.font(pathGV);
            return;
        }
    }
    
    // 2. Inter
    if (fontLower.includes('inter')) {
        const pathBold = path.join(assetsDir, 'fonts/Inter-Bold.ttf');
        const pathReg = path.join(assetsDir, 'fonts/Inter-Regular.ttf');
        if (isBold && fs.existsSync(pathBold)) {
            doc.font(pathBold);
            return;
        } else if (fs.existsSync(pathReg)) {
            doc.font(pathReg);
            return;
        }
    }
    
    // 3. Outfit
    if (fontLower.includes('outfit')) {
        const pathBold = path.join(assetsDir, 'fonts/Outfit-Bold.ttf');
        const pathReg = path.join(assetsDir, 'fonts/Outfit-Regular.ttf');
        if (isBold && fs.existsSync(pathBold)) {
            doc.font(pathBold);
            return;
        } else if (fs.existsSync(pathReg)) {
            doc.font(pathReg);
            return;
        }
    }

    // 4. Montserrat
    if (fontLower.includes('montserrat')) {
        const pathBold = path.join(assetsDir, 'fonts/Montserrat-Bold.ttf');
        const pathReg = path.join(assetsDir, 'fonts/Montserrat-Regular.ttf');
        if (isBold && fs.existsSync(pathBold)) {
            doc.font(pathBold);
            return;
        } else if (fs.existsSync(pathReg)) {
            doc.font(pathReg);
            return;
        }
    }

    // 5. Playfair Display
    if (fontLower.includes('playfair')) {
        const pathBold = path.join(assetsDir, 'fonts/PlayfairDisplay-Bold.ttf');
        const pathReg = path.join(assetsDir, 'fonts/PlayfairDisplay-Regular.ttf');
        if (isBold && fs.existsSync(pathBold)) {
            doc.font(pathBold);
            return;
        } else if (fs.existsSync(pathReg)) {
            doc.font(pathReg);
            return;
        }
    }

    // 6. Georgia
    if (fontLower.includes('georgia')) {
        if (isBold && isItalic) doc.font('Times-BoldItalic');
        else if (isBold) doc.font('Times-Bold');
        else if (isItalic) doc.font('Times-Italic');
        else doc.font('Times-Roman');
        return;
    }
    
    // 7. Courier
    if (fontLower.includes('courier')) {
        if (isBold && isItalic) doc.font('Courier-BoldOblique');
        else if (isBold) doc.font('Courier-Bold');
        else if (isItalic) doc.font('Courier-Oblique');
        else doc.font('Courier');
        return;
    }

    doc.font(defaultFont);
}

/**
 * Generates a multi-page PDF by overlaying text on background images.
 * @param {Object} data - Intern/Employee data
 * @param {Object} template - { orientation, pages: [{ backgroundUrl, placeholders, paragraphs }] }
 */
async function generateDynamicPDF(data, template = {}) {
    const orientation = template.orientation || 'portrait';

    let pages = template.pages;
    if (!pages || pages.length === 0) {
        pages = [{
            backgroundUrl: template.backgroundUrl || '',
            placeholders: template.placeholders || [],
            paragraphs: template.paragraphs || []
        }];
    }

    const assetsDir = path.join(__dirname, '../assets');
    const width  = orientation === 'portrait' ? 595.28 : 841.89;
    const height = orientation === 'portrait' ? 841.89 : 595.28;

    return new Promise(async (resolve, reject) => {
        try {
            const doc = new PDFDocument({
                size: 'A4',
                layout: orientation,
                margin: 0,
                autoFirstPage: false
            });

            const buffers = [];
            doc.on('data', buffers.push.bind(buffers));
            doc.on('end', () => resolve(Buffer.concat(buffers)));

            for (let i = 0; i < pages.length; i++) {
                const page = pages[i];

                doc.addPage({ size: 'A4', layout: orientation, margin: 0 });

                // 1. Draw background image
                if (page.backgroundUrl) {
                    const bgBuffer = await getAssetBuffer(page.backgroundUrl);
                    if (bgBuffer) {
                        doc.image(bgBuffer, 0, 0, { width, height });
                    }
                }

                // 2. Draw Legacy Placeholder Chips
                const placeholders = page.placeholders || [];
                for (const p of placeholders) {
                    let text = data[p.key] || '';
                    if (p.key.toLowerCase().includes('date') && text) {
                        text = moment(text).format('DD MMM YYYY');
                    }
                    setPdfFont(doc, 'inherit', p.isBold, false, assetsDir);
                    doc.fontSize(p.fontSize || 12)
                       .fillColor(p.color || '#000000')
                       .text(text, p.x, p.y);
                }

                // 3. Draw Rich Paragraph Blocks
                const paragraphs = page.paragraphs || [];
                for (const para of paragraphs) {
                    let text = resolveParagraphText(para.text, data);
                    if (!text) continue;

                    setPdfFont(doc, para.fontFamily, para.isBold, para.isItalic, assetsDir);
                    
                    // Approximate letter spacing (characterSpacing) in ems to points
                    // 1em = current font size in points
                    const charSpacingPt = (para.letterSpacing || 0) * (para.fontSize || 14);

                    doc.fontSize(para.fontSize || 14)
                       .fillColor(para.color || '#000000');
                    
                    // Detect leading spaces for paragraph indentation (e.g. tab space)
                    let indent = 0;
                    const leadingSpaces = text.match(/^ +/);
                    if (leadingSpaces) {
                        // A space is roughly 0.33 times the font size
                        indent = leadingSpaces[0].length * (para.fontSize || 14) * 0.33;
                        // Strip leading spaces from raw text so PDFKit's native indent handles it cleanly
                        text = text.replace(/^ +/, '');
                    }

                    // Subtract 16px to account for the HTML box padding (8px left + 8px right) 
                    // so the wrap boundary matches the canvas preview exactly.
                    const finalWidth = Math.max(20, (para.width || 400) - 16);

                    // PDFKit options
                    const options = {
                        width: finalWidth,
                        align: para.alignment || 'left',
                        characterSpacing: charSpacingPt > 0 ? charSpacingPt : 0,
                        indent: indent > 0 ? indent : 0
                    };
                    
                    // Line height approximation. 
                    // PDFKit's lineGap is added to the standard line height. 
                    // Standard line height is ~1.2x font size.
                    // If user selects lineHeight = 1.6, we need (1.6 - 1.2) * fontSize gap.
                    const desiredLineHeight = (para.lineHeight || 1.6);
                    const standardLineHeight = 1.2; 
                    if (desiredLineHeight > standardLineHeight) {
                        options.lineGap = (desiredLineHeight - standardLineHeight) * (para.fontSize || 14);
                    }

                    // Apply +10px X and +14px Y offsets to perfectly align with HTML editor padding, borders, and line-height centering
                    const finalX = (para.x || 0) + 10;
                    const finalY = (para.y || 0) + 24;

                    doc.text(text, finalX, finalY, options);
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
