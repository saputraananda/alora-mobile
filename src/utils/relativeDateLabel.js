/**
 * Relative calendar-day label in Indonesian for announcement cards.
 * @param {string|Date|null|undefined} dateInput
 * @returns {string}
 */
export function relativeDateLabel(dateInput) {
  if (!dateInput) return '';

  const date = dateInput instanceof Date ? dateInput : new Date(dateInput);
  if (Number.isNaN(date.getTime())) return '';

  const startOfDay = (d) => {
    const x = new Date(d);
    x.setHours(0, 0, 0, 0);
    return x;
  };

  const today = startOfDay(new Date());
  const target = startOfDay(date);
  const diffDays = Math.round((today - target) / 86400000);

  if (diffDays === 0) return 'Hari ini';
  if (diffDays === 1) return 'Kemarin';
  if (diffDays >= 2 && diffDays <= 6) return `${diffDays} hari lalu`;

  return date.toLocaleDateString('id-ID', { day: '2-digit', month: 'short' });
}
