import { spawn } from 'child_process';
import { join } from 'path';

// Dashboard directory (read from environment or use default)
const DASHBOARD_DIR = process.env.SHARDS_LEDGER_APP_DIR ||
  '/Users/jeffreyenneking/My Drive (jeffrey@enneking.company)/Production-Projects/Shards-Ledger-App';

/**
 * Trigger dashboard data refresh by running compare-by-location script
 *
 * This executes the existing Shards-Ledger-App script that reads
 * parsed-ledgers-detailed.json and generates location-comparison.json
 *
 * @returns {Promise<Object>} Result with success status and script output
 */
export async function triggerDashboardRefresh() {
  console.log('[Refresh] Triggering dashboard data refresh...');
  console.log('[Refresh] Dashboard directory:', DASHBOARD_DIR);

  return new Promise((resolve, reject) => {
    const scriptPath = join(DASHBOARD_DIR, 'scripts', 'compare-by-location.mjs');

    console.log('[Refresh] Executing script:', scriptPath);

    const proc = spawn('node', [scriptPath], {
      cwd: DASHBOARD_DIR,
      stdio: 'pipe',
      env: {
        ...process.env,
        NODE_ENV: 'production' // Prevent dev-only behavior
      }
    });

    let stdout = '';
    let stderr = '';

    proc.stdout.on('data', (data) => {
      const output = data.toString().trim();
      stdout += output + '\n';
      console.log('[Refresh]', output);
    });

    proc.stderr.on('data', (data) => {
      const output = data.toString().trim();
      stderr += output + '\n';
      console.error('[Refresh Error]', output);
    });

    proc.on('error', (error) => {
      console.error('[Refresh] Failed to spawn process:', error);
      reject(new Error(`Failed to spawn script: ${error.message}`));
    });

    proc.on('close', (code) => {
      if (code === 0) {
        console.log('[Refresh] Dashboard data refresh complete');
        console.log('[Refresh] location-comparison.json should now be updated');
        resolve({
          success: true,
          stdout: stdout.trim(),
          stderr: stderr.trim()
        });
      } else {
        console.error(`[Refresh] Dashboard refresh failed with exit code ${code}`);
        console.error(`[Refresh] stderr:`, stderr);
        reject(new Error(`Script failed with code ${code}: ${stderr || 'No error output'}`));
      }
    });
  });
}
