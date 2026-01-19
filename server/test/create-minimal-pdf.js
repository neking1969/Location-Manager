/**
 * Creates a minimal valid PDF with text content that pdf-parse can read
 * Based on PDF-1.4 specification with proper byte counting
 */

const fs = require('fs');
const path = require('path');

function createMinimalPDF(text, outputPath) {
  // We'll build the PDF as a Buffer to ensure proper byte counting
  let pdf = Buffer.alloc(0);

  const appendString = (str) => {
    pdf = Buffer.concat([pdf, Buffer.from(str, 'binary')]);
  };

  const getOffset = () => pdf.length;

  // PDF Header
  appendString('%PDF-1.4\n%\xFF\xFF\xFF\xFF\n');

  // Prepare content stream
  const lines = text.split('\n');
  let y = 750;
  let streamContent = 'BT\n/F1 10 Tf\n';
  for (const line of lines) {
    const escapedLine = line
      .replace(/\\/g, '\\\\')
      .replace(/\(/g, '\\(')
      .replace(/\)/g, '\\)')
      .replace(/[^\x20-\x7E]/g, '');

    if (escapedLine.trim()) {
      streamContent += `1 0 0 1 50 ${y} Tm\n(${escapedLine}) Tj\n`;
    }
    y -= 12;
    if (y < 50) break;
  }
  streamContent += 'ET';
  const streamLength = streamContent.length;

  // Object offsets for xref table
  const offsets = [];

  // Object 1: Catalog
  offsets.push(getOffset());
  appendString('1 0 obj\n<< /Type /Catalog /Pages 2 0 R >>\nendobj\n');

  // Object 2: Pages
  offsets.push(getOffset());
  appendString('2 0 obj\n<< /Type /Pages /Kids [3 0 R] /Count 1 >>\nendobj\n');

  // Object 3: Page
  offsets.push(getOffset());
  appendString('3 0 obj\n<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Contents 4 0 R /Resources << /Font << /F1 5 0 R >> >> >>\nendobj\n');

  // Object 4: Content stream
  offsets.push(getOffset());
  appendString(`4 0 obj\n<< /Length ${streamLength} >>\nstream\n${streamContent}\nendstream\nendobj\n`);

  // Object 5: Font
  offsets.push(getOffset());
  appendString('5 0 obj\n<< /Type /Font /Subtype /Type1 /BaseFont /Courier >>\nendobj\n');

  // Cross-reference table
  const xrefOffset = getOffset();
  appendString('xref\n');
  appendString(`0 ${offsets.length + 1}\n`);
  appendString('0000000000 65535 f \n'); // Object 0 is always free

  for (const offset of offsets) {
    const offsetStr = offset.toString().padStart(10, '0');
    appendString(`${offsetStr} 00000 n \n`);
  }

  // Trailer
  appendString('trailer\n');
  appendString(`<< /Size ${offsets.length + 1} /Root 1 0 R >>\n`);
  appendString('startxref\n');
  appendString(`${xrefOffset}\n`);
  appendString('%%EOF\n');

  fs.writeFileSync(outputPath, pdf);
  console.log(`Created PDF: ${outputPath} (${pdf.length} bytes)`);
  return outputPath;
}

// Test it
const testDir = path.join(__dirname, 'fixtures');
if (!fs.existsSync(testDir)) {
  fs.mkdirSync(testDir, { recursive: true });
}

const sampleText = `GL 505 General Ledger
Production Location Costs Report

Acct: 6304 - LOCATION SECURITY
6304     QE  101  A01  01/15-01/16 SECURITY:LATCHFORD HOUSE     APEX SECURITY INC        123456  2,500.00
6304     QE  101  A02  01/17-01/18 SECURITY:DOWNTOWN LOFT       APEX SECURITY INC        123457  1,800.00
6304     QE  102  B01  01/20-01/21 SECURITY:BUCKLEY GYM         SECURE PARTNERS LLC      123458  3,200.00

Acct: 6305 - LOCATION POLICE
6305     QE  101  A01  01/15-01/16 POLICE:LATCHFORD HOUSE       LAPD OFF-DUTY            223456  1,200.00
6305     QE  102  B01  01/20-01/21 POLICE:BUCKLEY GYM           LAPD OFF-DUTY            223457  1,500.00

Acct: 6307 - LOCATION FIREMAN
6307     QE  101  A01  01/15-01/16 FIRE:LATCHFORD HOUSE         LAFD FIRE WATCH          323456    800.00
6307     QE  102  B01  01/20-01/21 FIRE:BUCKLEY GYM             LAFD FIRE WATCH          323457    950.00

Acct: 6342 - FEES & PERMITS
6342     QE  101  A01  01/15-01/16 PERMIT:LATCHFORD HOUSE       FILM LA                  423456    350.00
6342     QE  101  A01  01/15-01/16 TENTS:LATCHFORD HOUSE        PARTY RENTAL INC         423457  1,500.00
6342     QE  102  B01  01/20-01/21 PERMIT:BUCKLEY GYM           FILM LA                  423458    275.00
6342     QE  102  B01  01/20-01/21 GENERATOR:BUCKLEY GYM        POWER SOLUTIONS          423459  2,100.00`;

const pdfPath = createMinimalPDF(sampleText, path.join(testDir, 'sample-ledger.pdf'));

// Test reading it back
const pdfParse = require('pdf-parse');
const dataBuffer = fs.readFileSync(pdfPath);

console.log('\nTesting pdf-parse...');
pdfParse(dataBuffer)
  .then(data => {
    console.log('SUCCESS! PDF parsed correctly.');
    console.log('Number of pages:', data.numpages);
    console.log('\nExtracted text (first 1000 chars):');
    console.log(data.text.substring(0, 1000));

    const isLedger = data.text.includes('General Ledger') ||
                     data.text.includes('GL 505') ||
                     /Acct:\s*\d{4}/.test(data.text);
    console.log('\nIs ledger format:', isLedger);
  })
  .catch(err => {
    console.log('ERROR:', err.message);
    console.log('\nDebug: Checking PDF structure...');
    const pdfContent = fs.readFileSync(pdfPath, 'binary');
    console.log('PDF starts with:', pdfContent.substring(0, 50));
    console.log('PDF ends with:', pdfContent.substring(pdfContent.length - 50));
  });
