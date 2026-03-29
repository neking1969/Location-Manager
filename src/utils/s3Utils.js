import { S3Client, PutObjectCommand, GetObjectCommand } from '@aws-sdk/client-s3';

const s3Client = new S3Client({ region: process.env.AWS_REGION || 'us-west-2' });
const BUCKET = process.env.AWS_S3_BUCKET || 'location-manager-prod';

export async function writeJsonToS3(key, data) {
  const command = new PutObjectCommand({
    Bucket: BUCKET,
    Key: key,
    Body: JSON.stringify(data, null, 2),
    ContentType: 'application/json'
  });
  const result = await s3Client.send(command);
  console.log(`[S3] Wrote JSON to s3://${BUCKET}/${key}`);
  return { key, bucket: BUCKET, ...result };
}

export async function uploadFileToS3(key, buffer, contentType) {
  const command = new PutObjectCommand({
    Bucket: BUCKET,
    Key: key,
    Body: buffer,
    ContentType: contentType
  });
  const result = await s3Client.send(command);
  console.log(`[S3] Uploaded file to s3://${BUCKET}/${key} (${buffer.length} bytes)`);
  return { key, bucket: BUCKET, size: buffer.length, ...result };
}

export async function readJsonFromS3(key) {
  const command = new GetObjectCommand({
    Bucket: BUCKET,
    Key: key
  });
  const response = await s3Client.send(command);
  const bodyString = await response.Body.transformToString();
  return JSON.parse(bodyString);
}
