/** Active cutoff month/year: if day > 25, roll to next calendar month. */
export function getDefaultCutoff(now = new Date()) {
  const day = now.getDate();
  let cutoffMonth = now.getMonth() + 1;
  let cutoffYear = now.getFullYear();
  if (day > 25) {
    cutoffMonth += 1;
    if (cutoffMonth > 12) {
      cutoffMonth = 1;
      cutoffYear += 1;
    }
  }
  return { cutoffMonth, cutoffYear };
}
