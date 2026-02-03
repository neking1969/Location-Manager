/**
 * Download files from URLs (for Lambda integration with Make.com)
 *
 * Make.com sends file URLs from Glide, we need to download them
 * before processing
 */

/**
 * Download a file from a URL and return buffer + filename
 *
 * @param {string} url - File URL (from Glide or other source)
 * @returns {Promise<{filename: string, buffer: Buffer}>}
 */
export async function downloadFile(url) {
  console.log(`[Download] Starting download from URL: ${url}`);

  try {
    const response = await fetch(url);

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }

    // Get the buffer
    const arrayBuffer = await response.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);

    console.log(`[Download] File downloaded successfully: ${buffer.length} bytes`);

    // Extract filename from URL or Content-Disposition header
    let filename = extractFilenameFromUrl(url);

    const contentDisposition = response.headers.get('content-disposition');
    if (contentDisposition) {
      const filenameMatch = contentDisposition.match(/filename[^;=\n]*=((['"]).*?\2|[^;\n]*)/);
      if (filenameMatch && filenameMatch[1]) {
        filename = filenameMatch[1].replace(/['"]/g, '');
      }
    }

    console.log(`[Download] Extracted filename: ${filename}`);

    return { filename, buffer };
  } catch (error) {
    console.error(`[Download] Failed to download file from ${url}:`, error.message);
    throw new Error(`Failed to download file: ${error.message}`);
  }
}

/**
 * Download multiple files in parallel
 *
 * @param {string[]} urls - Array of file URLs
 * @returns {Promise<Array<{filename: string, buffer: Buffer}>>}
 */
export async function downloadFiles(urls) {
  console.log(`[Download] Downloading ${urls.length} files in parallel`);

  const downloads = urls.map(url => downloadFile(url));
  const results = await Promise.all(downloads);

  console.log(`[Download] All files downloaded successfully`);
  return results;
}

/**
 * Extract filename from URL path
 *
 * @param {string} url - File URL
 * @returns {string} Extracted filename or 'unknown.pdf'
 */
function extractFilenameFromUrl(url) {
  try {
    const urlObj = new URL(url);
    const pathname = urlObj.pathname;
    const segments = pathname.split('/');
    const lastSegment = segments[segments.length - 1];

    if (lastSegment && lastSegment.includes('.')) {
      return decodeURIComponent(lastSegment);
    }
  } catch (error) {
    console.warn(`[Download] Could not parse URL for filename: ${error.message}`);
  }

  return 'unknown.pdf';
}

export default {
  downloadFile,
  downloadFiles
};
