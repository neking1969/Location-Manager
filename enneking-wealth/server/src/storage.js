// S3-backed persistent storage for Lambda, with local filesystem fallback for dev
const fs = require('fs');
const path = require('path');

const BUCKET = 'enneking-wealth-app';
const DATA_PREFIX = 'data/';
const IS_LAMBDA = !!process.env.LAMBDA_TASK_ROOT;

let s3Client = null;

function getS3() {
  if (!s3Client) {
    const { S3Client } = require('@aws-sdk/client-s3');
    s3Client = new S3Client({ region: process.env.AWS_REGION || 'us-west-2' });
  }
  return s3Client;
}

async function loadJSON(filename, defaultValue) {
  if (IS_LAMBDA) {
    try {
      const { GetObjectCommand } = require('@aws-sdk/client-s3');
      const resp = await getS3().send(new GetObjectCommand({
        Bucket: BUCKET,
        Key: DATA_PREFIX + filename,
      }));
      const body = await resp.Body.transformToString();
      return JSON.parse(body);
    } catch (err) {
      if (err.name === 'NoSuchKey' || err.Code === 'NoSuchKey') {
        return typeof defaultValue === 'function' ? defaultValue() : { ...defaultValue };
      }
      console.error(`S3 load error (${filename}):`, err.message);
      return typeof defaultValue === 'function' ? defaultValue() : { ...defaultValue };
    }
  } else {
    // Local filesystem for development
    const dir = path.join(__dirname, '../data');
    const file = path.join(dir, filename);
    try {
      if (fs.existsSync(file)) return JSON.parse(fs.readFileSync(file, 'utf8'));
    } catch (err) {
      console.error(`File load error (${filename}):`, err.message);
    }
    return typeof defaultValue === 'function' ? defaultValue() : { ...defaultValue };
  }
}

async function saveJSON(filename, data) {
  if (IS_LAMBDA) {
    try {
      const { PutObjectCommand } = require('@aws-sdk/client-s3');
      await getS3().send(new PutObjectCommand({
        Bucket: BUCKET,
        Key: DATA_PREFIX + filename,
        Body: JSON.stringify(data, null, 2),
        ContentType: 'application/json',
      }));
    } catch (err) {
      console.error(`S3 save error (${filename}):`, err.message);
      throw err;
    }
  } else {
    const dir = path.join(__dirname, '../data');
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
    fs.writeFileSync(path.join(dir, filename), JSON.stringify(data, null, 2));
  }
}

module.exports = { loadJSON, saveJSON };
