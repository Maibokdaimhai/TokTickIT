import path from 'node:path';
// Regression runs keep fresh captures separate from earlier feature/PR evidence.
export function screenshotDirectory(section: string) {
  return path.join(process.env.E2E_LAB4_SCREENSHOTS_DIR ?? 'artifacts/lab-04/screenshots', section);
}
