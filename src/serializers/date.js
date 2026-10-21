const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

/**
 * Formats a date string or timestamp into 'DD Mon YYYY' in 'Asia/Kolkata' timezone.
 * Example: '12 Sep 2026'.
 */
function formatDate(input) {
  if (!input) return null;
  const d = new Date(input);
  if (isNaN(d.getTime())) return String(input);

  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: 'Asia/Kolkata',
    day: '2-digit',
    month: 'numeric',
    year: 'numeric'
  }).formatToParts(d);

  const day = parts.find(p => p.type === 'day').value.padStart(2, '0');
  const monthIndex = parseInt(parts.find(p => p.type === 'month').value, 10) - 1;
  const year = parts.find(p => p.type === 'year').value;

  return `${day} ${MONTHS[monthIndex]} ${year}`;
}

module.exports = {
  formatDate
};
