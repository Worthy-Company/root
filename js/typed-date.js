// A date you can just type. "8/1", "08/01", "Aug 1", "22 SEP", "8/1/25",
// "August 1, 2025", "2025-08-01" and "2025" all work; the software says what
// it understood, and says so when it can't tell. Shared by every page with a
// date field, so it lives here in js/, next to format.js.
//
// Rules (Nate's): month first in a slash date (US order, matching how his
// institutions print them); no year means this year; a two-digit year is
// 20xx; a bare year stays a year (a transaction may only be known to the
// year); a date that doesn't exist (2/30) is "can't tell". Formats are added
// as real statements bring them (Citi prints "08/01").
//
// No build step and no library on purpose. If real use ever wants relative
// words ("last Tuesday", "the 3rd"), the option is to vendor a finished
// date-parsing library (chrono-node) as one file loaded with a script tag.
// Not needed yet; check that it ships as a ready-to-load browser file first.
//
// TODO: finance/test/typed-date.mjs tests this generally, through finance's
// transaction form, because that is the only page using it so far. The test
// belongs in root's test/ and needs to move there once a second page uses
// the field, so the general test isn't repeated per page.

const TYPED_DATE_MONTHS = ['january', 'february', 'march', 'april', 'may', 'june', 'july', 'august', 'september', 'october', 'november', 'december'];

// A month's name, in full or cut short to at least three letters ("Sept").
function typedDateMonthNumber(word) {
  const w = word.toLowerCase();
  if (w.length < 3) return 0;
  const i = TYPED_DATE_MONTHS.findIndex(m => m.startsWith(w));
  return i + 1;
}

// Returns null if the date doesn't exist (2/30), else { date: 'YYYY-MM-DD' }.
function typedDateBuild(year, month, day) {
  const d = new Date(year, month - 1, day);
  if (d.getFullYear() !== year || d.getMonth() !== month - 1 || d.getDate() !== day) return null;
  return { date: `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}` };
}

function typedDateYear(text, thisYear) {
  if (!text) return thisYear;
  const n = parseInt(text, 10);
  return text.length === 2 ? 2000 + n : n;
}

// What was typed, as { date } (a full date), { year } (just a year), {} (nothing
// typed), or null (can't tell).
function parseTypedDate(text, now = new Date()) {
  const s = (text || '').trim().replace(/\s+/g, ' ');
  if (!s) return {};
  const thisYear = now.getFullYear();
  let m;

  if ((m = s.match(/^(\d{4})$/))) return { year: parseInt(m[1], 10) };

  if ((m = s.match(/^(\d{4})-(\d{1,2})-(\d{1,2})$/))) {
    return typedDateBuild(parseInt(m[1], 10), parseInt(m[2], 10), parseInt(m[3], 10));
  }

  // Month first: 8/1, 08/01, 8/1/25, 8-1-2025, 8.1.25
  if ((m = s.match(/^(\d{1,2})[\/\-.](\d{1,2})(?:[\/\-.](\d{4}|\d{2}))?$/))) {
    return typedDateBuild(typedDateYear(m[3], thisYear), parseInt(m[1], 10), parseInt(m[2], 10));
  }

  // Aug 1, Aug 1 2025, August 1st, 2025
  if ((m = s.match(/^([A-Za-z]{3,9})\.? (\d{1,2})(?:st|nd|rd|th)?(?:,? ?(\d{4}|\d{2}))?$/))) {
    const month = typedDateMonthNumber(m[1]);
    return month ? typedDateBuild(typedDateYear(m[3], thisYear), month, parseInt(m[2], 10)) : null;
  }

  // Day first, as some statements print it: 22 SEP, 22 Sep 2025
  if ((m = s.match(/^(\d{1,2}) ([A-Za-z]{3,9})\.?(?:,? ?(\d{4}|\d{2}))?$/))) {
    const month = typedDateMonthNumber(m[2]);
    return month ? typedDateBuild(typedDateYear(m[3], thisYear), month, parseInt(m[1], 10)) : null;
  }

  return null;
}

// How the understood date reads back to the person, with the day of the week
// (useful when diagnosing a charge): "Sat, Aug 1, 2026", or just "2025".
function describeTypedDate(parsed) {
  if (parsed && parsed.date) {
    return new Date(parsed.date + 'T00:00:00').toLocaleDateString('en-US', { weekday: 'short', year: 'numeric', month: 'short', day: 'numeric' });
  }
  if (parsed && parsed.year) return String(parsed.year);
  return '';
}

// Wires a text input so that, as the person types, `noteEl` says what was
// understood (or that it couldn't tell). Returns a function that refreshes
// the note after the input's value is set from code.
function wireTypedDate(inputEl, noteEl) {
  const refresh = () => {
    const parsed = parseTypedDate(inputEl.value);
    if (parsed === null) noteEl.textContent = "I couldn't tell which date that is. Try something like 8/1 or Aug 1.";
    else if (!parsed.date && !parsed.year) noteEl.textContent = '';
    else noteEl.textContent = 'Understood as ' + describeTypedDate(parsed);
  };
  inputEl.addEventListener('input', refresh);
  inputEl.addEventListener('change', refresh);
  return refresh;
}
