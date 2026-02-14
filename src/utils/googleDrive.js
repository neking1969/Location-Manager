import { GoogleAuth } from 'google-auth-library';

const DRIVE_API = 'https://www.googleapis.com/drive/v3';

let cachedAuth = null;

export async function getAuth() {
  if (cachedAuth) return cachedAuth;

  const keyBase64 = process.env.GOOGLE_SERVICE_ACCOUNT_KEY;
  if (!keyBase64) throw new Error('GOOGLE_SERVICE_ACCOUNT_KEY not configured');

  const keyJson = JSON.parse(Buffer.from(keyBase64, 'base64').toString('utf8'));

  const auth = new GoogleAuth({
    credentials: keyJson,
    scopes: ['https://www.googleapis.com/auth/drive']
  });

  cachedAuth = auth;
  return auth;
}

export async function listFiles(auth, folderId) {
  const client = await auth.getClient();
  const token = await client.getAccessToken();

  const query = `'${folderId}' in parents and trashed = false`;
  const url = `${DRIVE_API}/files?q=${encodeURIComponent(query)}&fields=files(id,name,mimeType,modifiedTime,size)&orderBy=modifiedTime desc&pageSize=100`;

  const resp = await fetch(url, {
    headers: { 'Authorization': `Bearer ${token.token}` }
  });

  if (!resp.ok) {
    const err = await resp.text();
    throw new Error(`Drive API listFiles failed (${resp.status}): ${err}`);
  }

  const data = await resp.json();
  return data.files || [];
}

export async function downloadFile(auth, fileId, mimeType) {
  const client = await auth.getClient();
  const token = await client.getAccessToken();

  let url;
  if (mimeType && mimeType.startsWith('application/vnd.google-apps.')) {
    const exportMime = 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';
    url = `${DRIVE_API}/files/${fileId}/export?mimeType=${encodeURIComponent(exportMime)}`;
  } else {
    url = `${DRIVE_API}/files/${fileId}?alt=media`;
  }

  const resp = await fetch(url, {
    headers: { 'Authorization': `Bearer ${token.token}` }
  });

  if (!resp.ok) {
    const err = await resp.text();
    throw new Error(`Drive API download failed (${resp.status}): ${err}`);
  }

  const arrayBuffer = await resp.arrayBuffer();
  return Buffer.from(arrayBuffer);
}

export async function moveFile(auth, fileId, fromFolderId, toFolderId) {
  const client = await auth.getClient();
  const token = await client.getAccessToken();

  const url = `${DRIVE_API}/files/${fileId}?addParents=${toFolderId}&removeParents=${fromFolderId}`;

  const resp = await fetch(url, {
    method: 'PATCH',
    headers: {
      'Authorization': `Bearer ${token.token}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({})
  });

  if (!resp.ok) {
    const err = await resp.text();
    throw new Error(`Drive API moveFile failed (${resp.status}): ${err}`);
  }

  return await resp.json();
}

export async function scanAndDownloadNewFiles(auth, folderId, folderLabel) {
  const files = await listFiles(auth, folderId);
  console.log(`[GoogleDrive] Found ${files.length} files in ${folderLabel} folder`);

  const results = [];
  for (const file of files) {
    try {
      const buffer = await downloadFile(auth, file.id, file.mimeType);
      console.log(`[GoogleDrive] Downloaded: ${file.name} (${buffer.length} bytes)`);
      results.push({
        filename: file.name,
        buffer,
        driveFileId: file.id,
        mimeType: file.mimeType,
        modifiedTime: file.modifiedTime,
        size: file.size
      });
    } catch (e) {
      console.error(`[GoogleDrive] Failed to download ${file.name}: ${e.message}`);
    }
  }

  return results;
}
