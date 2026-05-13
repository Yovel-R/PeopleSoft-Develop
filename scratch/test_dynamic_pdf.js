const { generateOfferLetter } = require('../utilities/offerLetterGenerator');
const fs = require('fs');
const path = require('path');

async function test() {
    const mockIntern = {
        fullName: 'Test Candidate',
        role: 'Full Stack Developer',
        onboardingDate: new Date(),
        endDate: new Date(Date.now() + 90 * 24 * 60 * 60 * 1000)
    };

    const mockSettings = {
        companyName: 'Acme Corp',
        address: '123 Acme St, Toon Town, 12345',
        contact: 'support@acme.com',
        website: 'www.acme.com',
        signatoryName: 'Bugs Bunny',
        signatoryRole: 'Chief Mischief Officer',
        workLocation: 'Toon Town Office',
        // Using a publicly available placeholder image for logo and signature
        logoUrl: 'https://via.placeholder.com/300x100.png?text=ACME+LOGO',
        signatureUrl: 'https://via.placeholder.com/200x50.png?text=Bugs+Bunny'
    };

    try {
        console.log("Generating PDF with mock settings...");
        const buffer = await generateOfferLetter(mockIntern, mockSettings);
        
        const outputPath = path.join(__dirname, 'test_offer_letter.pdf');
        fs.writeFileSync(outputPath, buffer);
        console.log("PDF generated successfully at:", outputPath);
    } catch (err) {
        console.error("Test failed:", err);
    }
}

test();
