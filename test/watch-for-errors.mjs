// Attach this to a page before it navigates, and check the returned array
// near the end of a test. Catches what state-based assertions can miss: an
// uncaught exception, or a console.error nobody looked at — either can
// happen and leave the visible page looking fine, especially if it's
// swallowed into a variable nobody checked (see how-we-work/testing.md).
//
// Usage:
//   const pageErrors = watchForErrors(page);
//   ...
//   expect('no unexpected errors occurred', pageErrors.length === 0, pageErrors.join('\n'));
// Chrome logs every network-level 404 to the console as an "error," whether
// or not the page's own code handles it. ghReadFile (js/github.js)
// deliberately treats 404 as "file doesn't exist yet" and returns null —
// a normal, expected path used throughout this codebase for optional
// files — so that specific noise is excluded here. Anything else logged as
// an error, or any uncaught exception, still fails.
const BENIGN = /Failed to load resource.*404/i;

export function watchForErrors(page) {
  const errors = [];
  page.on('pageerror', (err) => errors.push('Uncaught error: ' + err.message));
  page.on('console', (msg) => {
    if (msg.type() === 'error' && !BENIGN.test(msg.text())) errors.push('console.error: ' + msg.text());
  });
  return errors;
}
