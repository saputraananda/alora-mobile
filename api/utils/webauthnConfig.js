export function getWebAuthnConfig() {
  return {
    rpID: process.env.WEBAUTHN_RP_ID || 'localhost',
    rpName: process.env.WEBAUTHN_RP_NAME || 'Alora Mobile',
    origin: process.env.WEBAUTHN_ORIGIN || process.env.CORS_ORIGIN || 'http://localhost:1000',
  };
}
