/**
 * Helper untuk membentuk URL lengkap avatar / foto profil.
 * Mendukung full URL (http/https), path absolut (/assets/...), maupun path relatif.
 */
export function getAvatarUrl(filePath) {
  if (!filePath) return null;

  const str = String(filePath).trim();
  if (!str) return null;

  // Jika sudah full URL (misal dari CDN / Cloud)
  if (/^https?:\/\//i.test(str)) {
    return str;
  }

  // Base URL superapp backend tempat file avatar tersimpan
  const base = (
    import.meta.env.VITE_SUPERAPP_API_URL ||
    import.meta.env.VITE_API_URL ||
    'https://api.waschenalora.com'
  ).replace(/\/$/, '');

  let clean = str.replace(/^\/+/, '');
  if (!clean.startsWith('assets/')) {
    clean = `assets/${clean}`;
  }

  return `${base}/${clean}`;
}
