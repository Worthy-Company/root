// Small general-purpose helpers shared by pages. Presentation (turning values
// into text for display) lives in format.js; this file is for parsing and
// calculation.

// '$1,234.50' or '1234.5' -> 123450. Returns null for anything that isn't a
// plain dollar amount.
function dollarsToCents(text) {
  const cleaned = String(text ?? '').replace(/[$,\s]/g, '');
  if (!/^-?\d+(\.\d+)?$/.test(cleaned)) return null;
  return Math.round(Number(cleaned) * 100);
}

// 'YYYY-MM-DD' moved `months` later (or earlier), keeping the day of the
// month. A day the target month doesn't have is clamped to its last day, and
// the last day of a month stays the last day (Jan 31 -> Feb 28 -> Mar 31).
function addMonthsClamped(dateStr, months) {
  const [y, m, d] = dateStr.split('-').map(Number);
  const lastDayOfOriginalMonth = new Date(y, m, 0).getDate();
  const isEndOfMonth = d === lastDayOfOriginalMonth;
  const target = new Date(y, m - 1 + months, 1);
  const lastDayOfTargetMonth = new Date(target.getFullYear(), target.getMonth() + 1, 0).getDate();
  const day = isEndOfMonth ? lastDayOfTargetMonth : Math.min(d, lastDayOfTargetMonth);
  target.setDate(day);
  return `${target.getFullYear()}-${String(target.getMonth() + 1).padStart(2, '0')}-${String(target.getDate()).padStart(2, '0')}`;
}
