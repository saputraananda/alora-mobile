/**
 * Formats a string to Title Case (Capital Each Word)
 * @param {string} name 
 * @returns {string}
 */
export const formatName = (name) => {
  if (!name || typeof name !== 'string') return '';
  return name
    .trim()
    .toLowerCase()
    .split(/\s+/)
    .map(word => word.charAt(0).toUpperCase() + word.slice(1))
    .join(' ');
};
