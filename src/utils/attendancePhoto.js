export function fileNameFromPath(filePath) {
  if (!filePath) return '';
  const parts = String(filePath).split('/');
  return parts[parts.length - 1] || '';
}

export async function fetchAttendancePhotoBlob(api, filePath) {
  const name = fileNameFromPath(filePath);
  if (!name) return null;
  const res = await api.get(`/attendance/file/${encodeURIComponent(name)}`, { responseType: 'blob' });
  return URL.createObjectURL(res.data);
}
