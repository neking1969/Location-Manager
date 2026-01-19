const { chromium } = require('playwright');
const fs = require('fs');
const path = require('path');

// Create test directory if needed
const testDir = path.join(__dirname, 'fixtures');
if (!fs.existsSync(testDir)) {
  fs.mkdirSync(testDir, { recursive: true });
}

// Generate a sample GL 505 General Ledger PDF using Playwright
async function createSampleLedgerPDF(outputPath) {
  const html = `
<!DOCTYPE html>
<html>
<head>
  <style>
    body { font-family: Courier, monospace; font-size: 10px; padding: 20px; }
    h1 { font-size: 14px; text-align: center; }
    h2 { font-size: 12px; text-align: center; margin-bottom: 20px; }
    .account-header { font-size: 11px; font-weight: bold; margin-top: 15px; }
    .header-row { font-weight: bold; border-bottom: 1px solid #000; }
    table { width: 100%; border-collapse: collapse; margin-bottom: 10px; }
    td, th { padding: 2px 4px; text-align: left; white-space: nowrap; }
    .amount { text-align: right; }
  </style>
</head>
<body>
  <h1>GL 505 General Ledger</h1>
  <h2>Production Location Costs Report</h2>

  <div class="account-header">Acct: 6304 - LOCATION SECURITY</div>
  <table>
    <tr class="header-row">
      <td>Account</td><td>LO</td><td>EPI</td><td>SET</td><td>Description</td><td>Vendor</td><td>Trans#</td><td class="amount">Amount</td>
    </tr>
    <tr><td>6304</td><td>QE</td><td>101</td><td>A01</td><td>01/15-01/16 SECURITY:LATCHFORD HOUSE</td><td>APEX SECURITY INC</td><td>123456</td><td class="amount">2,500.00</td></tr>
    <tr><td>6304</td><td>QE</td><td>101</td><td>A02</td><td>01/17-01/18 SECURITY:DOWNTOWN LOFT</td><td>APEX SECURITY INC</td><td>123457</td><td class="amount">1,800.00</td></tr>
    <tr><td>6304</td><td>QE</td><td>102</td><td>B01</td><td>01/20-01/21 SECURITY:BUCKLEY GYM</td><td>SECURE PARTNERS LLC</td><td>123458</td><td class="amount">3,200.00</td></tr>
  </table>

  <div class="account-header">Acct: 6305 - LOCATION POLICE</div>
  <table>
    <tr class="header-row">
      <td>Account</td><td>LO</td><td>EPI</td><td>SET</td><td>Description</td><td>Vendor</td><td>Trans#</td><td class="amount">Amount</td>
    </tr>
    <tr><td>6305</td><td>QE</td><td>101</td><td>A01</td><td>01/15-01/16 POLICE:LATCHFORD HOUSE</td><td>LAPD OFF-DUTY</td><td>223456</td><td class="amount">1,200.00</td></tr>
    <tr><td>6305</td><td>QE</td><td>102</td><td>B01</td><td>01/20-01/21 POLICE:BUCKLEY GYM</td><td>LAPD OFF-DUTY</td><td>223457</td><td class="amount">1,500.00</td></tr>
  </table>

  <div class="account-header">Acct: 6307 - LOCATION FIREMAN</div>
  <table>
    <tr class="header-row">
      <td>Account</td><td>LO</td><td>EPI</td><td>SET</td><td>Description</td><td>Vendor</td><td>Trans#</td><td class="amount">Amount</td>
    </tr>
    <tr><td>6307</td><td>QE</td><td>101</td><td>A01</td><td>01/15-01/16 FIRE:LATCHFORD HOUSE</td><td>LAFD FIRE WATCH</td><td>323456</td><td class="amount">800.00</td></tr>
    <tr><td>6307</td><td>QE</td><td>102</td><td>B01</td><td>01/20-01/21 FIRE:BUCKLEY GYM</td><td>LAFD FIRE WATCH</td><td>323457</td><td class="amount">950.00</td></tr>
  </table>

  <div class="account-header">Acct: 6342 - FEES & PERMITS</div>
  <table>
    <tr class="header-row">
      <td>Account</td><td>LO</td><td>EPI</td><td>SET</td><td>Description</td><td>Vendor</td><td>Trans#</td><td class="amount">Amount</td>
    </tr>
    <tr><td>6342</td><td>QE</td><td>101</td><td>A01</td><td>01/15-01/16 PERMIT:LATCHFORD HOUSE</td><td>FILM LA</td><td>423456</td><td class="amount">350.00</td></tr>
    <tr><td>6342</td><td>QE</td><td>101</td><td>A01</td><td>01/15-01/16 TENTS:LATCHFORD HOUSE</td><td>PARTY RENTAL INC</td><td>423457</td><td class="amount">1,500.00</td></tr>
    <tr><td>6342</td><td>QE</td><td>102</td><td>B01</td><td>01/20-01/21 PERMIT:BUCKLEY GYM</td><td>FILM LA</td><td>423458</td><td class="amount">275.00</td></tr>
    <tr><td>6342</td><td>QE</td><td>102</td><td>B01</td><td>01/20-01/21 GENERATOR:BUCKLEY GYM</td><td>POWER SOLUTIONS</td><td>423459</td><td class="amount">2,100.00</td></tr>
  </table>
</body>
</html>`;

  const browser = await chromium.launch();
  const page = await browser.newPage();
  await page.setContent(html);
  await page.pdf({ path: outputPath, format: 'Letter' });
  await browser.close();

  console.log(`Created sample PDF: ${outputPath}`);
  return outputPath;
}

// Upload PDF to server using multipart form
async function uploadPDF(filePath, projectId = 'test-project') {
  const FormData = require('form-data');
  const axios = require('axios');

  const form = new FormData();
  form.append('file', fs.createReadStream(filePath));

  try {
    const response = await axios.post(
      `http://localhost:5001/api/upload/ledger/${projectId}`,
      form,
      { headers: form.getHeaders() }
    );
    return response.data;
  } catch (error) {
    if (error.response) {
      return { error: error.response.data };
    }
    throw error;
  }
}

// Simple test runner
async function runTests() {
  console.log('=== PDF Ledger Upload Test ===\n');

  // Test 1: Create sample PDF
  console.log('Test 1: Creating sample GL 505 ledger PDF with Playwright...');
  const pdfPath = path.join(testDir, 'sample-ledger.pdf');
  await createSampleLedgerPDF(pdfPath);
  console.log('PASS: PDF created\n');

  // Test 2: Verify PDF is readable
  console.log('Test 2: Verifying PDF is readable with pdf-parse...');
  const pdfParse = require('pdf-parse');
  const dataBuffer = fs.readFileSync(pdfPath);
  let pdfData;
  try {
    pdfData = await pdfParse(dataBuffer);
    console.log('Extracted text preview (first 1000 chars):');
    console.log(pdfData.text.substring(0, 1000));
    console.log('...\n');
    console.log('PASS: PDF readable\n');
  } catch (err) {
    console.log('FAIL: PDF parse error:', err.message);
    return;
  }

  // Test 3: Check if it's detected as ledger format
  console.log('Test 3: Checking ledger format detection...');
  const isLedger = pdfData.text.includes('General Ledger') ||
                   pdfData.text.includes('GL 505') ||
                   /Acct:\s*\d{4}/.test(pdfData.text);
  console.log(`Is ledger format: ${isLedger}`);
  if (!isLedger) {
    console.log('FAIL: PDF not detected as ledger format');
    console.log('Full extracted text:');
    console.log(pdfData.text);
    return;
  }
  console.log('PASS: Ledger format detected\n');

  // Test 4: Upload to server
  console.log('Test 4: Uploading to server...');
  try {
    const result = await uploadPDF(pdfPath, 'test-project');
    console.log('Upload result:');
    console.log(JSON.stringify(result, null, 2));

    if (result.error) {
      console.log('\nFAIL: Upload returned error');
      console.log('Error details:', result.error);
    } else if (result.entries_found > 0) {
      console.log(`\nPASS: Parsed ${result.entries_found} entries successfully!`);
      console.log(`Episodes/locations found: ${result.grouped?.length || 0} groups`);
    } else {
      console.log('\nFAIL: No entries parsed');
      console.log('The PDF text was parsed but no entries were extracted.');
      console.log('This suggests the parsing regex patterns need adjustment.');
      console.log('\nFull PDF text for debugging:');
      console.log(pdfData.text);
    }
  } catch (error) {
    console.log('FAIL: Upload error:', error.message);
    if (error.code === 'ECONNREFUSED') {
      console.log('Make sure the server is running on port 5001');
    }
  }

  console.log('\n=== Tests Complete ===');
}

runTests().catch(console.error);
