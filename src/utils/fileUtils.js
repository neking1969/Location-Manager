/**
 * File utility functions for reading/writing JSON, CSV, etc.
 */

import { readFileSync, writeFileSync, readdirSync, existsSync } from 'fs';
import { parse } from 'csv-parse/sync';
import { stringify } from 'csv-stringify/sync';

/**
 * Read and parse a JSON file
 */
export function readJSON(filePath) {
  if (!existsSync(filePath)) {
    return null;
  }
  const content = readFileSync(filePath, 'utf-8');
  return JSON.parse(content);
}

/**
 * Write data to a JSON file with pretty formatting
 */
export function writeJSON(filePath, data) {
  const content = JSON.stringify(data, null, 2);
  writeFileSync(filePath, content, 'utf-8');
}

/**
 * Read and parse a CSV file
 */
export function readCSV(filePath, options = {}) {
  if (!existsSync(filePath)) {
    return [];
  }
  const content = readFileSync(filePath, 'utf-8');
  return parse(content, {
    columns: true,
    skip_empty_lines: true,
    trim: true,
    ...options
  });
}

/**
 * Write data to a CSV file
 */
export function writeCSV(filePath, data, options = {}) {
  const content = stringify(data, {
    header: true,
    ...options
  });
  writeFileSync(filePath, content, 'utf-8');
}

/**
 * List files in a directory matching a pattern
 */
export function listFiles(dirPath, extensions = []) {
  if (!existsSync(dirPath)) {
    return [];
  }
  const files = readdirSync(dirPath);
  if (extensions.length === 0) {
    return files;
  }
  return files.filter(f => extensions.some(ext => f.toLowerCase().endsWith(ext)));
}

/**
 * Parse filename to extract episode, account, and date
 * Format: "101 6304 011626.pdf" -> { episode: "101", account: "6304", date: "2026-01-16" }
 */
export function parseFilename(filename) {
  // Pattern: EPISODE ACCOUNT MMDDYY.ext or EPISODE ACCOUNT-ACCOUNT MMDDYY.ext
  const match = filename.match(/^(\d{3})\s+(\d{4}(?:-\d{4})?)\s+(\d{6})\.(pdf|xlsx|jpg)$/i);
  if (!match) {
    return null;
  }

  const [, episode, account, dateStr] = match;

  // Parse date MMDDYY to YYYY-MM-DD
  const month = dateStr.substring(0, 2);
  const day = dateStr.substring(2, 4);
  const year = '20' + dateStr.substring(4, 6);
  const date = `${year}-${month}-${day}`;

  return { episode, account, date, filename };
}

/**
 * Generate a hash for deduplication
 */
export function generateHash(obj) {
  const str = JSON.stringify(obj);
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    const char = str.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash; // Convert to 32-bit integer
  }
  return Math.abs(hash).toString(16).substring(0, 12);
}

/**
 * Get current timestamp in ISO format
 */
export function timestamp() {
  return new Date().toISOString();
}

export default {
  readJSON,
  writeJSON,
  readCSV,
  writeCSV,
  listFiles,
  parseFilename,
  generateHash,
  timestamp
};
