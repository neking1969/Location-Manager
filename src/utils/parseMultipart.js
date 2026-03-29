/**
 * Minimal multipart/form-data parser for Lambda Function URLs.
 * No external dependencies — parses raw binary boundaries.
 *
 * Lambda Function URLs base64-encode binary bodies and set event.isBase64Encoded = true.
 */

/**
 * Parse a multipart/form-data body into fields and files.
 *
 * @param {Buffer} bodyBuffer - Raw body bytes
 * @param {string} boundary  - Multipart boundary string (from Content-Type header)
 * @returns {{ fields: Record<string,string>, files: Array<{fieldName:string, filename:string, contentType:string, buffer:Buffer}> }}
 */
export function parseMultipart(bodyBuffer, boundary) {
  const fields = {};
  const files = [];

  const delimiter = Buffer.from(`--${boundary}`);
  const closeDelimiter = Buffer.from(`--${boundary}--`);

  let start = indexOf(bodyBuffer, delimiter, 0);
  if (start === -1) return { fields, files };

  while (true) {
    // Move past delimiter + CRLF
    start += delimiter.length;
    if (bodyBuffer[start] === 0x2d && bodyBuffer[start + 1] === 0x2d) break; // --boundary-- (closing)
    if (bodyBuffer[start] === 0x0d) start += 2; // skip CRLF

    // Find end of headers (double CRLF)
    const headerEnd = indexOf(bodyBuffer, Buffer.from('\r\n\r\n'), start);
    if (headerEnd === -1) break;

    const headerBlock = bodyBuffer.slice(start, headerEnd).toString('utf8');
    const bodyStart = headerEnd + 4;

    // Find next delimiter
    const nextDelimiter = indexOf(bodyBuffer, delimiter, bodyStart);
    if (nextDelimiter === -1) break;

    // Body ends 2 bytes before next delimiter (CRLF before boundary)
    const bodyEnd = nextDelimiter - 2;
    const partBody = bodyBuffer.slice(bodyStart, bodyEnd);

    // Parse headers
    const headers = {};
    for (const line of headerBlock.split('\r\n')) {
      const colonIdx = line.indexOf(':');
      if (colonIdx > 0) {
        headers[line.slice(0, colonIdx).trim().toLowerCase()] = line.slice(colonIdx + 1).trim();
      }
    }

    const disposition = headers['content-disposition'] || '';
    const nameMatch = disposition.match(/name="([^"]+)"/);
    const filenameMatch = disposition.match(/filename="([^"]+)"/);
    const fieldName = nameMatch ? nameMatch[1] : 'unknown';

    if (filenameMatch) {
      files.push({
        fieldName,
        filename: filenameMatch[1],
        contentType: headers['content-type'] || 'application/octet-stream',
        buffer: partBody,
      });
    } else {
      fields[fieldName] = partBody.toString('utf8');
    }

    start = nextDelimiter;
  }

  return { fields, files };
}

/**
 * Extract the boundary from a Content-Type header.
 * e.g. "multipart/form-data; boundary=----WebKitFormBoundary..." → "----WebKitFormBoundary..."
 */
export function extractBoundary(contentType) {
  if (!contentType) return null;
  const match = contentType.match(/boundary=([^\s;]+)/);
  return match ? match[1] : null;
}

/** Buffer.indexOf polyfill for finding needle in haystack */
function indexOf(haystack, needle, offset) {
  for (let i = offset; i <= haystack.length - needle.length; i++) {
    let found = true;
    for (let j = 0; j < needle.length; j++) {
      if (haystack[i + j] !== needle[j]) {
        found = false;
        break;
      }
    }
    if (found) return i;
  }
  return -1;
}
