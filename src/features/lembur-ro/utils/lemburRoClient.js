export function jakartaWeekday(dateStr) {
  const d = new Date(`${dateStr}T12:00:00+07:00`);
  return d.getUTCDay();
}

function parseTimeParts(timeStr) {
  const m = String(timeStr || '').trim().match(/^(\d{1,2}):(\d{2})$/);
  if (!m) return null;
  const h = Number(m[1]);
  const min = Number(m[2]);
  if (h < 0 || h > 23 || min < 0 || min > 59) return null;
  return { h, min };
}

export function computeDurationHours(workDate, startTime, endTime) {
  const startParts = parseTimeParts(startTime);
  const endParts = parseTimeParts(endTime);
  if (!startParts || !endParts || !/^\d{4}-\d{2}-\d{2}$/.test(workDate)) {
    return { error: 'Format tanggal atau waktu tidak valid' };
  }

  const pad = (n) => String(n).padStart(2, '0');
  const startAt = new Date(`${workDate}T${pad(startParts.h)}:${pad(startParts.min)}:00+07:00`);
  const endAt = new Date(`${workDate}T${pad(endParts.h)}:${pad(endParts.min)}:00+07:00`);

  if (Number.isNaN(startAt.getTime()) || Number.isNaN(endAt.getTime())) {
    return { error: 'Format tanggal atau waktu tidak valid' };
  }
  if (endAt <= startAt) {
    return { error: 'Jam selesai harus setelah jam mulai' };
  }

  const hours = Math.round(((endAt - startAt) / 3600000) * 100) / 100;
  return { durationHours: hours };
}
