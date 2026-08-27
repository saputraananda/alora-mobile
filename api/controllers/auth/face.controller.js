import { aloraMobilePool } from '../../db/pool.js';
import { findUserByUsername, findUserById } from '../../utils/authUser.js';
import { buildLoginSuccessResponse } from './login.controller.js';
import { decryptEmbedding, encryptEmbedding, EMBEDDING_SIZE } from '../../utils/faceCrypto.js';
import { averageDescriptors, verifyEnrollDescriptors, verifyLoginProbes } from '../../utils/faceMatch.js';
import { checkFaceLoginRateLimit } from '../../utils/faceRateLimit.js';

const MODEL_VERSION = process.env.FACE_MODEL_VERSION || 'face-api-v1';

function assertSelfUser(req, userId) {
  const requested = Number(userId);
  const authed = Number(req.user?.id);
  return Number.isInteger(requested) && requested === authed;
}

function parseDescriptor(value) {
  if (!Array.isArray(value) || value.length !== EMBEDDING_SIZE) return null;
  if (!value.every((n) => typeof n === 'number' && Number.isFinite(n))) return null;
  return value;
}

function parseDescriptors(body) {
  if (Array.isArray(body?.descriptors) && body.descriptors.length > 0) {
    const parsed = body.descriptors.map(parseDescriptor).filter(Boolean);
    return parsed.length > 0 ? parsed : null;
  }
  const single = parseDescriptor(body?.descriptor);
  return single ? [single] : null;
}

export const getFaceStatus = async (req, res) => {
  try {
    const userId = Number(req.query.userId);
    if (!assertSelfUser(req, userId)) {
      return res.status(403).json({ success: false, message: 'Akses ditolak' });
    }

    const [[row]] = await aloraMobilePool.query(
      'SELECT user_id, model_version, sample_count, created_at FROM user_face_credentials WHERE user_id = ? LIMIT 1',
      [userId],
    );

    return res.json({
      success: true,
      isEnrolled: !!row,
      modelVersion: row?.model_version ?? null,
      sampleCount: row?.sample_count ?? 0,
      enrolledAt: row?.created_at ?? null,
    });
  } catch (error) {
    console.error('[face] getFaceStatus', error);
    return res.status(500).json({ success: false, message: 'Terjadi kesalahan server' });
  }
};

export const enrollFace = async (req, res) => {
  try {
    const userId = Number(req.body?.userId);
    if (!assertSelfUser(req, userId)) {
      return res.status(403).json({ success: false, message: 'Akses ditolak' });
    }

    const descriptors = parseDescriptors(req.body);
    if (!descriptors) {
      return res.status(400).json({ success: false, message: 'Data wajah tidak valid' });
    }

    const enrollCheck = verifyEnrollDescriptors(descriptors);
    if (!enrollCheck.ok) {
      return res.status(400).json({ success: false, message: enrollCheck.message });
    }

    const averaged = averageDescriptors(descriptors);
    const encrypted = encryptEmbedding(averaged);

    await aloraMobilePool.query(
      `INSERT INTO user_face_credentials
        (user_id, embedding_encrypted, model_version, sample_count)
       VALUES (?, ?, ?, ?)
       ON DUPLICATE KEY UPDATE
        embedding_encrypted = VALUES(embedding_encrypted),
        model_version = VALUES(model_version),
        sample_count = VALUES(sample_count),
        updated_at = CURRENT_TIMESTAMP`,
      [userId, encrypted, MODEL_VERSION, descriptors.length],
    );

    return res.json({
      success: true,
      message: 'Wajah berhasil didaftarkan sebagai kode terenkripsi',
    });
  } catch (error) {
    console.error('[face] enrollFace', error);
    return res.status(500).json({ success: false, message: error.message || 'Gagal menyimpan wajah' });
  }
};

export const removeFace = async (req, res) => {
  try {
    const userId = Number(req.body?.userId);
    if (!assertSelfUser(req, userId)) {
      return res.status(403).json({ success: false, message: 'Akses ditolak' });
    }

    await aloraMobilePool.query(
      'DELETE FROM user_face_credentials WHERE user_id = ?',
      [userId],
    );
    return res.json({ success: true, message: 'Data wajah dihapus' });
  } catch (error) {
    console.error('[face] removeFace', error);
    return res.status(500).json({ success: false, message: 'Gagal menghapus data wajah' });
  }
};

export const faceLogin = async (req, res) => {
  try {
    const ip = req.ip || req.headers['x-forwarded-for'] || '';
    if (!checkFaceLoginRateLimit(ip, '')) {
      return res.status(429).json({ success: false, message: 'Terlalu banyak percobaan. Coba lagi nanti.' });
    }

    const descriptors = parseDescriptors(req.body);
    const requiredSamples = Number(process.env.FACE_LOGIN_SAMPLES) || 2;

    if (!descriptors || descriptors.length !== requiredSamples) {
      return res.status(400).json({
        success: false,
        message: 'Login wajah memerlukan 2 sampel verifikasi',
      });
    }

    const [rows] = await aloraMobilePool.query(
      'SELECT user_id, embedding_encrypted FROM user_face_credentials',
    );

    if (!rows.length) {
      return res.status(400).json({
        success: false,
        message: 'Belum ada wajah terdaftar. Login password lalu daftar di Profil.',
      });
    }

    const candidates = rows.map((row) => ({
      userId: row.user_id,
      enrolled: decryptEmbedding(row.embedding_encrypted),
    }));

    const verification = verifyLoginProbes(descriptors, candidates);

    if (!verification.ok) {
      return res.status(401).json({ success: false, message: verification.message });
    }

    const dbUser = await findUserById(verification.userId);
    if (!dbUser) {
      return res.status(404).json({ success: false, message: 'Akun tidak ditemukan' });
    }

    const loginName = dbUser.username || dbUser.email || String(dbUser.id);
    return res.status(200).json(
      buildLoginSuccessResponse(dbUser, loginName, 'Login wajah berhasil!'),
    );
  } catch (error) {
    console.error('[face] faceLogin', error);
    return res.status(500).json({ success: false, message: error.message || 'Login wajah gagal' });
  }
};

export const hasFaceEnrollment = async (req, res) => {
  try {
    const trimmedUsername = String(req.query.username || '').trim();
    if (!trimmedUsername) {
      return res.json({ success: true, hasEnrollment: false });
    }

    const dbUser = await findUserByUsername(trimmedUsername);
    if (!dbUser) {
      return res.json({ success: true, hasEnrollment: false });
    }

    const [[row]] = await aloraMobilePool.query(
      'SELECT 1 FROM user_face_credentials WHERE user_id = ? LIMIT 1',
      [dbUser.id],
    );
    return res.json({ success: true, hasEnrollment: !!row });
  } catch (error) {
    console.error('[face] hasFaceEnrollment', error);
    return res.status(500).json({ success: false, message: 'Terjadi kesalahan server' });
  }
};
