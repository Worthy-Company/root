// Re-exported here so checks living in life/test and finance/test can import
// Playwright without needing their own node_modules — it is installed once,
// under test/, and shared.
export { chromium } from 'playwright';
