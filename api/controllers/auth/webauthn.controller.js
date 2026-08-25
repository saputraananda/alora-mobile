import {
  generateAuthenticationOptions,
  generateRegistrationOptions,
  verifyAuthenticationResponse,
  verifyRegistrationResponse,
} from '@simplewebauthn/server';
import { isoBase64URL, isoUint8Array } from '@simplewebauthn/server/helpers';
import getAloraMobilePrisma from '../../db/aloraMobilePrisma.js';
import { findUserById, findUserByUsername } from '../../utils/authUser.js';
import { buildLoginSuccessResponse } from './login.controller.js';
import { getWebAuthnConfig } from '../../utils/webauthnConfig.js';
import { consumeChallenge, setChallenge } from '../../utils/webauthnChallengeStore.js';

function assertSelfUser(req, userId) {
  const requested = Number(userId);
  const authed = Number(req.user?.id);
  return Number.isInteger(requested) && requested === authed;
}

async function loadCredentialsForUser(userId) {
  const prisma = getAloraMobilePrisma();
  return prisma.userWebauthnCredential.findMany({
    where: { userId },
    orderBy: { createdAt: 'desc' },
  });
}

function toAuthenticatorDevice(row) {
  let transports = [];
  if (row.transports) {
    try {
      transports = JSON.parse(row.transports);
    } catch {
      transports = [];
    }
  }
  return {
    id: row.credentialId,
    publicKey: isoBase64URL.toBuffer(row.publicKey),
    counter: Number(row.counter),
    transports,
  };
}

export const getWebauthnStatus = async (req, res) => {
  try {
    const userId = Number(req.query.userId);
    if (!assertSelfUser(req, userId)) {
      return res.status(403).json({ success: false, message: 'Akses ditolak' });
    }

    const rows = await loadCredentialsForUser(userId);
    return res.json({
      success: true,
      isRegistered: rows.length > 0,
      count: rows.length,
      biometrics: rows.map((row) => ({
        id: row.id,
        deviceName: row.deviceName || 'Perangkat biometrik',
        createdAt: row.createdAt,
        deviceType: row.deviceType,
      })),
    });
  } catch (error) {
    console.error('[webauthn] getWebauthnStatus', error);
    return res.status(500).json({ success: false, message: 'Terjadi kesalahan server' });
  }
};

export const registerOptions = async (req, res) => {
  try {
    const userId = Number(req.body?.userId);
    if (!assertSelfUser(req, userId)) {
      return res.status(403).json({ success: false, message: 'Akses ditolak' });
    }

    const dbUser = await findUserById(userId);
    if (!dbUser) {
      return res.status(404).json({ success: false, message: 'User tidak ditemukan' });
    }

    const { rpID, rpName } = getWebAuthnConfig();
    const existing = await loadCredentialsForUser(userId);

    const options = await generateRegistrationOptions({
      rpName,
      rpID,
      userName: dbUser.email || dbUser.username || String(userId),
      userID: isoUint8Array.fromUTF8String(String(userId)),
      userDisplayName: dbUser.full_name || dbUser.name || dbUser.username || 'Pegawai Alora',
      attestationType: 'none',
      authenticatorSelection: {
        authenticatorAttachment: 'platform',
        userVerification: 'required',
        residentKey: 'preferred',
      },
      excludeCredentials: existing.map((row) => ({
        id: row.credentialId,
        transports: row.transports ? JSON.parse(row.transports) : undefined,
      })),
    });

    setChallenge(options.challenge, { userId, type: 'registration' });
    return res.json({ success: true, options });
  } catch (error) {
    console.error('[webauthn] registerOptions', error);
    return res.status(500).json({ success: false, message: 'Gagal menyiapkan registrasi biometrik' });
  }
};

export const registerVerify = async (req, res) => {
  try {
    const userId = Number(req.body?.userId);
    const response = req.body?.response;
    const deviceName = typeof req.body?.deviceName === 'string' ? req.body.deviceName.slice(0, 100) : 'Face ID / Touch ID';

    if (!assertSelfUser(req, userId)) {
      return res.status(403).json({ success: false, message: 'Akses ditolak' });
    }
    if (!response) {
      return res.status(400).json({ success: false, message: 'Response biometrik tidak valid' });
    }

    const { origin, rpID } = getWebAuthnConfig();
    const verification = await verifyRegistrationResponse({
      response,
      expectedChallenge: (challenge) => !!consumeChallenge(challenge, 'registration', userId),
      expectedOrigin: origin,
      expectedRPID: rpID,
      requireUserVerification: true,
    });

    if (!verification.verified || !verification.registrationInfo) {
      return res.status(400).json({ success: false, message: 'Verifikasi registrasi biometrik gagal' });
    }

    const { credential, credentialDeviceType, credentialBackedUp } = verification.registrationInfo;
    const prisma = getAloraMobilePrisma();

    await prisma.userWebauthnCredential.create({
      data: {
        userId,
        credentialId: credential.id,
        publicKey: isoBase64URL.fromBuffer(credential.publicKey),
        counter: BigInt(credential.counter),
        deviceType: credentialDeviceType,
        backedUp: credentialBackedUp,
        transports: credential.transports?.length ? JSON.stringify(credential.transports) : null,
        deviceName,
      },
    });

    return res.json({
      success: true,
      message: 'Biometrik berhasil didaftarkan',
    });
  } catch (error) {
    console.error('[webauthn] registerVerify', error);
    return res.status(500).json({ success: false, message: error.message || 'Gagal menyimpan biometrik' });
  }
};

export const removeCredentials = async (req, res) => {
  try {
    const userId = Number(req.body?.userId);
    if (!assertSelfUser(req, userId)) {
      return res.status(403).json({ success: false, message: 'Akses ditolak' });
    }

    const prisma = getAloraMobilePrisma();
    await prisma.userWebauthnCredential.deleteMany({ where: { userId } });
    return res.json({ success: true, message: 'Biometrik dihapus' });
  } catch (error) {
    console.error('[webauthn] removeCredentials', error);
    return res.status(500).json({ success: false, message: 'Gagal menghapus biometrik' });
  }
};

export const loginOptions = async (req, res) => {
  try {
    const trimmedUsername = String(req.body?.username || '').trim();
    if (!trimmedUsername) {
      return res.status(400).json({ success: false, message: 'Username wajib diisi' });
    }

    const dbUser = await findUserByUsername(trimmedUsername);
    if (!dbUser) {
      return res.status(404).json({ success: false, message: 'Akun tidak ditemukan' });
    }

    const rows = await loadCredentialsForUser(dbUser.id);
    if (rows.length === 0) {
      return res.status(400).json({
        success: false,
        message: 'Belum daftar Face ID. Login dengan password lalu daftar di Profil.',
      });
    }

    const { rpID } = getWebAuthnConfig();
    const options = await generateAuthenticationOptions({
      rpID,
      allowCredentials: rows.map((row) => ({
        id: row.credentialId,
        transports: row.transports ? JSON.parse(row.transports) : undefined,
      })),
      userVerification: 'required',
    });

    setChallenge(options.challenge, { userId: dbUser.id, type: 'authentication' });
    return res.json({ success: true, options });
  } catch (error) {
    console.error('[webauthn] loginOptions', error);
    return res.status(500).json({ success: false, message: 'Gagal menyiapkan login biometrik' });
  }
};

export const loginVerify = async (req, res) => {
  try {
    const trimmedUsername = String(req.body?.username || '').trim();
    const response = req.body?.response;

    if (!trimmedUsername || !response) {
      return res.status(400).json({ success: false, message: 'Data login biometrik tidak lengkap' });
    }

    const dbUser = await findUserByUsername(trimmedUsername);
    if (!dbUser) {
      return res.status(404).json({ success: false, message: 'Akun tidak ditemukan' });
    }

    const rows = await loadCredentialsForUser(dbUser.id);
    const matched = rows.find((row) => row.credentialId === response.id);
    if (!matched) {
      return res.status(400).json({ success: false, message: 'Kredensial biometrik tidak dikenali' });
    }

    const { origin, rpID } = getWebAuthnConfig();
    const verification = await verifyAuthenticationResponse({
      response,
      expectedChallenge: (challenge) => !!consumeChallenge(challenge, 'authentication', dbUser.id),
      expectedOrigin: origin,
      expectedRPID: rpID,
      credential: toAuthenticatorDevice(matched),
      requireUserVerification: true,
    });

    if (!verification.verified) {
      return res.status(401).json({ success: false, message: 'Verifikasi Face ID gagal' });
    }

    const prisma = getAloraMobilePrisma();
    await prisma.userWebauthnCredential.update({
      where: { id: matched.id },
      data: { counter: BigInt(verification.authenticationInfo.newCounter) },
    });

    return res.status(200).json(
      buildLoginSuccessResponse(
        dbUser,
        trimmedUsername,
        'Login Face Unlock berhasil!',
      ),
    );
  } catch (error) {
    console.error('[webauthn] loginVerify', error);
    return res.status(500).json({ success: false, message: error.message || 'Login biometrik gagal' });
  }
};

export const hasCredential = async (req, res) => {
  try {
    const trimmedUsername = String(req.query.username || '').trim();
    if (!trimmedUsername) {
      return res.json({ success: true, hasCredential: false });
    }
    const dbUser = await findUserByUsername(trimmedUsername);
    if (!dbUser) {
      return res.json({ success: true, hasCredential: false });
    }
    const rows = await loadCredentialsForUser(dbUser.id);
    return res.json({ success: true, hasCredential: rows.length > 0 });
  } catch (error) {
    console.error('[webauthn] hasCredential', error);
    return res.status(500).json({ success: false, message: 'Terjadi kesalahan server' });
  }
};
