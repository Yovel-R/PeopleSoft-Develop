const { generateDynamicPDF } = require('../utilities/certificateGenerator');
const fs = require('fs');
const path = require('path');

const mockData = {
    fullName: "John Doe",
    joinDate: "2023-01-15T00:00:00Z",
    companyName: "Acme Corp"
};

const mockTemplate = {
    orientation: 'portrait',
    pages: [{
        backgroundUrl: '', 
        placeholders: [
            { key: 'fullName', x: 100, y: 100, fontSize: 24, isBold: true, color: '#333333' }
        ],
        paragraphs: [
            {
                text: "This is to certify that {{fullName}} has successfully completed their tenure at {{companyName}}, joining on {{joinDate}}.",
                x: 100,
                y: 200,
                width: 400,
                fontSize: 16,
                fontFamily: "Inter",
                alignment: "justify",
                letterSpacing: 0.05,
                lineHeight: 1.5,
                isItalic: true,
                color: "#1a73e8"
            }
        ]
    }]
};

async function test() {
    try {
        console.log("Generating PDF with mock settings...");
        const buffer = await generateDynamicPDF(mockData, mockTemplate);
        const outputPath = path.join(__dirname, 'test_paragraph_certificate.pdf');
        fs.writeFileSync(outputPath, buffer);
        console.log("PDF generated successfully at:", outputPath);
    } catch (e) {
        console.error("Failed:", e);
    }
}
test();
