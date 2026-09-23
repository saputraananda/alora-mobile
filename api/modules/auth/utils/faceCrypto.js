import crypto from 'crypto';

const EMBEDDING_SIZE = 128;

function getKey() {
  const hex = String(process.env.FACE_EMBEDDING_SECRET || '').trim();
  if (hex.length !== 64 || !/^[0-9a-fA-F]{64}$/.test(hex)) {
    throw new Error(
      'FACE_EMBEDDING_SECRET tidak valid. Harus 64 karakter hex (32 byte). Generate: openssl rand -hex 32',
    );
  }
  return Buffer.from(hex, 'hex');
}

export function encryptEmbedding(floatArray) {
  if (!Array.isArray(floatArray) || floatArray.length !== EMBEDDING_SIZE) {
    throw new Error('Embedding tidak valid');
  }
  const payload = JSON.stringify(floatArray);
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv('aes-256-gcm', getKey(), iv);
  const encrypted = Buffer.concat([cipher.update(payload, 'utf8'), cipher.final()]);
  const tag = cipher.getAuthTag();
  return `${iv.toString('base64')}:${tag.toString('base64')}:${encrypted.toString('base64')}`;
}

export function decryptEmbedding(stored) {
  if (typeof stored !== 'string' || !stored.includes(':')) {
    throw new Error('Data embedding corrupt');
  }
  const [ivB64, tagB64, dataB64] = stored.split(':');
  const iv = Buffer.from(ivB64, 'base64');
  const tag = Buffer.from(tagB64, 'base64');
  const data = Buffer.from(dataB64, 'base64');
  const decipher = crypto.createDecipheriv('aes-256-gcm', getKey(), iv);
  decipher.setAuthTag(tag);
  const decrypted = Buffer.concat([decipher.update(data), decipher.final()]).toString('utf8');
  const arr = JSON.parse(decrypted);
  if (!Array.isArray(arr) || arr.length !== EMBEDDING_SIZE) {
    throw new Error('Embedding decrypt tidak valid');
  }
  return arr;
}

export { EMBEDDING_SIZE };
