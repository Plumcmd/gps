// lib/encryption.ts
import crypto from 'crypto';

const ALGORITHM = 'aes-256-gcm';
const ENCRYPTION_KEY = process.env.ENCRYPTION_KEY;

if (!ENCRYPTION_KEY) {
  throw new Error('❌ ENCRYPTION_KEY не установлен в .env.local');
}

const KEY_BUFFER = Buffer.from(ENCRYPTION_KEY, 'base64');

export function encrypt(plainText: string): string {
  if (!plainText?.trim()) {
    throw new Error('Текст для шифрования не может быть пустым');
  }

  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv(ALGORITHM, KEY_BUFFER, iv);

  const encrypted = Buffer.concat([
    cipher.update(plainText, 'utf8'),
    cipher.final(),
  ]);

  const authTag = cipher.getAuthTag();

  return Buffer.concat([iv, authTag, encrypted]).toString('base64');
}

export function decrypt(encryptedText: string): string {
  if (!encryptedText) {
    throw new Error('Нет данных для расшифровки');
  }

  const data = Buffer.from(encryptedText, 'base64');

  if (data.length < 28) {
    throw new Error('Повреждённые зашифрованные данные');
  }

  const iv = data.subarray(0, 12);
  const authTag = data.subarray(12, 28);
  const encrypted = data.subarray(28);

  const decipher = crypto.createDecipheriv(ALGORITHM, KEY_BUFFER, iv);
  decipher.setAuthTag(authTag);

  const decrypted = Buffer.concat([
    decipher.update(encrypted),
    decipher.final(),
  ]);

  return decrypted.toString('utf8');
}