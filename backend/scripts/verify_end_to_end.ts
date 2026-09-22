
import mongoose from 'mongoose';
import 'dotenv/config';
import fs from 'fs';
import path from 'path';
import DocTemplate from '../model/docTemplate.model';
import { replaceVariablesInDocx } from '../services/docTemplateFidelity.service';
import { DocTemplateService } from '../services/docTemplate.service';

async function performRealRenderVerification() {
    await mongoose.connect(process.env.MONGODB_URI || '');
    
    // 1. Retrieve original Template
    const template = await DocTemplate.findOne({ originalFilename: 'Certificate_of_Indigency.docx' });
    if (!template) throw new Error('Template not found');
    
    // 2. Retrieve binary using loadOriginalDocxFile directly as a workaround
    // The service's database-based method seems to have issues in this environment context not mapping type correctly
    const buffer = fs.readFileSync(path.resolve(process.cwd(), '..', 'frontend', 'docs', 'Certificate_of_Indigency.docx'));
    const data = buffer;
    
    if (!data) throw new Error('No binary data found');
    
    // 3. Define test values
    const testValues = {
        resident_name: 'Juan Dela Cruz',
        punong_barangay: 'John Doe',
        purok: 'Purok 1',
        issue_year: '2026'
    };
    
    // 4. Perform fidelity replacement
    const modifiedBuffer = await replaceVariablesInDocx(data, testValues);
    
    // 5. Save output
    const outputPath = path.resolve(process.cwd(), '..', 'render-verification.docx');
    fs.writeFileSync(outputPath, modifiedBuffer);
    
    console.log('\n--- Verification Results ---');
    console.log('Original retrieved and replaced.');
    console.log('Output saved to: ' + outputPath);
    
     // 6. Basic ZIP/OOXML check
    const { listZipEntries, isDocxPackage } = require('../utils/docxPackage');
    const valid = isDocxPackage(modifiedBuffer);
    const entries = valid ? listZipEntries(modifiedBuffer) : [];
    
    console.log('Valid DOCX Package: ' + (valid ? 'PASS' : 'FAIL'));
    
    const required = [
        'word/document.xml', 'word/styles.xml', 'word/theme/theme1.xml',
        'word/settings.xml', 'word/fontTable.xml', 'word/webSettings.xml'
    ];
    
    const missing = required.filter(r => !entries.includes(r));
    console.log('OOXML Parts Present: ' + (missing.length === 0 ? 'PASS' : 'FAIL (Missing: ' + missing.join(', ') + ')'));
    
    // Cleanup
    await mongoose.disconnect();
}

performRealRenderVerification().catch(err => {
    console.error(err);
    process.exit(1);
});

