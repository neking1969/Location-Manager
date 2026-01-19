const PDFDocument = require('pdfkit');
const fs = require('fs');
const path = require('path');

// Generate test PDFs in the GL 505 "General Ledger List By Account: Detail" format
// This matches the Disney/Fox production ledger format

function generateGL505PDF(filename, data) {
  const doc = new PDFDocument({ size: 'LETTER', layout: 'landscape', margin: 30 });
  const outputPath = path.join(__dirname, filename);

  doc.pipe(fs.createWriteStream(outputPath));

  // Header section
  doc.fontSize(12).font('Helvetica-Bold');
  doc.text(data.showName, { align: 'center' });
  doc.fontSize(10).font('Helvetica');
  doc.text(data.studio, { align: 'center' });
  doc.moveDown(0.5);
  doc.fontSize(11).font('Helvetica-Bold');
  doc.text('General Ledger List By Account: Detail', { align: 'center' });
  doc.moveDown(1);

  // Meta info
  doc.fontSize(8).font('Helvetica');
  doc.text(`Project: ${data.projectCode}    Episode: ${data.episodes.join(',')}    Cost Period: ${data.costPeriod}`, { align: 'left' });
  doc.moveDown(1);

  // Process each account section
  for (const section of data.sections) {
    // Section header
    doc.fontSize(10).font('Helvetica-Bold');
    doc.fillColor('#333333');
    doc.text(`Acct: ${section.accountCode} - ${section.accountName}`);
    doc.moveDown(0.3);

    // Column headers
    doc.fontSize(7).font('Helvetica-Bold').fillColor('#666666');
    doc.text('Account   LO  EPI  SET  WC    Description                                            Vendor Name                Trans#  Eff. Date      Amount');
    doc.moveDown(0.2);

    // Draw a line
    doc.strokeColor('#cccccc').lineWidth(0.5);
    doc.moveTo(30, doc.y).lineTo(760, doc.y).stroke();
    doc.moveDown(0.3);

    // Entries
    doc.font('Courier').fontSize(7).fillColor('#000000');
    for (const entry of section.entries) {
      const line = formatEntryLine(section.accountCode, entry);
      doc.text(line);
    }

    doc.moveDown(1);
  }

  // Footer
  doc.fontSize(7).font('Helvetica');
  doc.text('GL 505 - General Ledger List By Account (ReportOption_a1 - GeneralLedgerByDetail_V31.RPT)', { align: 'left' });
  doc.text(`Printed On: ${new Date().toLocaleDateString()} ${new Date().toLocaleTimeString()}`, { align: 'right' });

  doc.end();

  console.log(`Generated: ${outputPath}`);
  return outputPath;
}

function formatEntryLine(accountCode, entry) {
  // Format: Account LO EPI SET WC Description Vendor Trans# Eff.Date Amount
  const account = accountCode.padEnd(8);
  const lo = (entry.lo || '01').padEnd(4);
  const epi = String(entry.episode).padEnd(5);
  const set = (entry.set || '').padEnd(5);
  const wc = (entry.wc || 'QW').padEnd(6);
  const description = entry.description.substring(0, 45).padEnd(50);
  const vendor = entry.vendor.substring(0, 25).padEnd(28);
  const transNum = String(entry.transNum).padEnd(8);
  const effDate = entry.effDate.padEnd(15);
  const amount = entry.amount.toFixed(2).padStart(10);

  return `${account}${lo}${epi}${set}${wc}${description}${vendor}${transNum}${effDate}${amount}`;
}

// Test data matching the screenshot format - Police entries with officer names
const testData1 = {
  showName: 'The Shards - Season 1',
  studio: 'Twentieth Century Fox Film Corp',
  projectCode: 'E62W',
  episodes: ['101', '102', '103'],
  costPeriod: '1 (05/07/25) To 17 (01/03/26)',
  sections: [
    {
      accountCode: '6305',
      accountName: 'LOCATION POLICE',
      entries: [
        { episode: '101', lo: '01', wc: 'QW', description: '10/25/25 : ALBIN, W : REGULAR 1X', vendor: 'ENTERTAINMENT PARTNERS', transNum: '1449', effDate: '10/25/2025', amount: 619.20 },
        { episode: '101', lo: '01', wc: 'QW', description: '10/25/25 : ALBIN, W : OVERTIME 1.5X', vendor: 'ENTERTAINMENT PARTNERS', transNum: '1449', effDate: '10/25/2025', amount: 348.30 },
        { episode: '101', lo: '01', wc: 'QW', description: '10/25/25 : ALBIN, W : MEAL PENALTY', vendor: 'ENTERTAINMENT PARTNERS', transNum: '1449', effDate: '10/25/2025', amount: 77.40 },
        { episode: '101', lo: '01', wc: 'QW', description: '10/25/25 : BOYD, R : REGULAR 1X', vendor: 'ENTERTAINMENT PARTNERS', transNum: '1449', effDate: '10/25/2025', amount: 619.20 },
        { episode: '101', lo: '01', wc: 'QW', description: '10/25/25 : BOYD, R : OVERTIME 1.5X', vendor: 'ENTERTAINMENT PARTNERS', transNum: '1449', effDate: '10/25/2025', amount: 464.40 },
        { episode: '101', lo: '01', wc: 'QW', description: '10/25/25 : CELIS, F : REGULAR 1X', vendor: 'ENTERTAINMENT PARTNERS', transNum: '1449', effDate: '10/25/2025', amount: 1238.40 },
        { episode: '102', lo: '01', wc: 'QW', description: '10/28/25 : CHAPMAN, M : REGULAR 1X', vendor: 'ENTERTAINMENT PARTNERS', transNum: '1450', effDate: '10/28/2025', amount: 1238.40 },
        { episode: '102', lo: '01', wc: 'QW', description: '10/28/25 : CHAPMAN, M : OVERTIME 1.5X', vendor: 'ENTERTAINMENT PARTNERS', transNum: '1450', effDate: '10/28/2025', amount: 348.30 },
        { episode: '102', lo: '01', wc: 'QW', description: '10/28/25 : CLINE, S : REGULAR 1X', vendor: 'ENTERTAINMENT PARTNERS', transNum: '1450', effDate: '10/28/2025', amount: 1238.40 },
        { episode: '103', lo: '01', wc: 'QW', description: '10/30/25 : DIAZ, E : REGULAR 1X', vendor: 'ENTERTAINMENT PARTNERS', transNum: '1451', effDate: '10/30/2025', amount: 1238.40 },
        { episode: '103', lo: '01', wc: 'QW', description: '10/30/25 : DIAZ, E : MOTORCYCLE ALLOWANCE', vendor: 'ENTERTAINMENT PARTNERS', transNum: '1451', effDate: '10/30/2025', amount: 300.00 },
      ]
    },
    {
      accountCode: '6304',
      accountName: 'LOCATION SECURITY',
      entries: [
        { episode: '101', lo: '01', wc: 'QW', description: '10/25/25 : JOHNSON, K : REGULAR 1X', vendor: 'SECURITY PARTNERS INC', transNum: '2001', effDate: '10/25/2025', amount: 450.00 },
        { episode: '101', lo: '01', wc: 'QW', description: '10/25/25 : WILLIAMS, T : REGULAR 1X', vendor: 'SECURITY PARTNERS INC', transNum: '2001', effDate: '10/25/2025', amount: 450.00 },
        { episode: '102', lo: '01', wc: 'QW', description: '10/28/25 : SMITH, J : REGULAR 1X', vendor: 'GUARD SERVICES LLC', transNum: '2002', effDate: '10/28/2025', amount: 525.00 },
        { episode: '103', lo: '01', wc: 'QW', description: '10/30/25 : GARCIA, M : REGULAR 1X', vendor: 'ABC SECURITY INC', transNum: '2003', effDate: '10/30/2025', amount: 475.00 },
      ]
    },
    {
      accountCode: '6307',
      accountName: 'LOCATION FIREMAN',
      entries: [
        { episode: '101', lo: '01', wc: 'QW', description: '10/25/25 : FIRE WATCH SERVICES', vendor: 'LAFD FIRE WATCH', transNum: '3001', effDate: '10/25/2025', amount: 950.00 },
        { episode: '102', lo: '01', wc: 'QW', description: '10/28/25 : FIRE WATCH SERVICES', vendor: 'LAFD FIRE WATCH', transNum: '3002', effDate: '10/28/2025', amount: 1200.00 },
        { episode: '103', lo: '01', wc: 'QW', description: '10/30/25 : FIRE SAFETY STANDBY', vendor: 'LAFD FIRE WATCH', transNum: '3003', effDate: '10/30/2025', amount: 875.00 },
      ]
    },
    {
      accountCode: '6342',
      accountName: 'FEES & PERMITS',
      entries: [
        { episode: '101', lo: '01', wc: 'QW', description: '10/25/25 : FILMING PERMIT - DOWNTOWN', vendor: 'FILM LA', transNum: '4001', effDate: '10/25/2025', amount: 1250.00 },
        { episode: '101', lo: '01', wc: 'QW', description: '10/25/25 : TENT RENTAL 20X30', vendor: 'PARTY RENTALS INC', transNum: '4002', effDate: '10/25/2025', amount: 800.00 },
        { episode: '102', lo: '01', wc: 'QW', description: '10/28/25 : FILMING PERMIT - BEACH', vendor: 'FILM LA', transNum: '4003', effDate: '10/28/2025', amount: 2100.00 },
        { episode: '102', lo: '01', wc: 'QW', description: '10/28/25 : RESTROOM TRAILER RENTAL', vendor: 'PORTA SERVICES LLC', transNum: '4004', effDate: '10/28/2025', amount: 650.00 },
        { episode: '103', lo: '01', wc: 'QW', description: '10/30/25 : FILMING PERMIT - WAREHOUSE', vendor: 'FILM LA', transNum: '4005', effDate: '10/30/2025', amount: 900.00 },
        { episode: '103', lo: '01', wc: 'QW', description: '10/30/25 : TABLES AND CHAIRS', vendor: 'RENTAL CENTER INC', transNum: '4006', effDate: '10/30/2025', amount: 425.00 },
      ]
    }
  ]
};

// Test data 2 - More episodes with varied costs
const testData2 = {
  showName: 'Test Production - Season 2',
  studio: 'Disney Television Animation',
  projectCode: 'TST2',
  episodes: ['201', '202'],
  costPeriod: '1 (01/01/25) To 8 (02/28/25)',
  sections: [
    {
      accountCode: '6305',
      accountName: 'LOCATION POLICE',
      entries: [
        { episode: '201', lo: '01', wc: 'QW', description: '01/15/25 : MARTINEZ, R : REGULAR 1X', vendor: 'ENTERTAINMENT PARTNERS', transNum: '5001', effDate: '01/15/2025', amount: 619.20 },
        { episode: '201', lo: '01', wc: 'QW', description: '01/15/25 : NGUYEN, T : REGULAR 1X', vendor: 'ENTERTAINMENT PARTNERS', transNum: '5001', effDate: '01/15/2025', amount: 619.20 },
        { episode: '202', lo: '01', wc: 'QW', description: '02/01/25 : DAVIS, K : DOUBLE TIME 2X', vendor: 'ENTERTAINMENT PARTNERS', transNum: '5002', effDate: '02/01/2025', amount: 928.80 },
      ]
    },
    {
      accountCode: '6304',
      accountName: 'LOCATION SECURITY',
      entries: [
        { episode: '201', lo: '01', wc: 'QW', description: '01/15/25 : OVERNIGHT SECURITY', vendor: 'METRO GUARD INC', transNum: '6001', effDate: '01/15/2025', amount: 1500.00 },
        { episode: '202', lo: '01', wc: 'QW', description: '02/01/25 : 24HR SECURITY DETAIL', vendor: 'CIVIC SECURITY', transNum: '6002', effDate: '02/01/2025', amount: 2200.00 },
      ]
    },
    {
      accountCode: '6342',
      accountName: 'FEES & PERMITS',
      entries: [
        { episode: '201', lo: '01', wc: 'QW', description: '01/15/25 : LOCATION SCOUT FEE', vendor: 'SCOUTS R US', transNum: '7001', effDate: '01/15/2025', amount: 350.00 },
        { episode: '202', lo: '01', wc: 'QW', description: '02/01/25 : GENERATOR RENTAL', vendor: 'POWER RENTALS', transNum: '7002', effDate: '02/01/2025', amount: 1800.00 },
      ]
    }
  ]
};

// Generate both test PDFs
console.log('Generating GL 505 format test PDFs...\n');
generateGL505PDF('test-ledger-gl505-standard.pdf', testData1);
generateGL505PDF('test-ledger-gl505-season2.pdf', testData2);
console.log('\nDone! Test PDFs created in the test directory.');
console.log('\nTo test, upload these PDFs via the app UI:');
console.log('  - test/test-ledger-gl505-standard.pdf');
console.log('  - test/test-ledger-gl505-season2.pdf');
