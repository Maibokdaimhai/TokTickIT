import path from 'node:path';
import { hasDisposableNameToken } from './db-guard.js';
import fs from 'node:fs/promises';
import { existsSync, lstatSync } from 'node:fs';

export function assertSafeUploadsDir(value = process.env.UPLOADS_DIR): string {
  const root = value ?? '/private/tmp/toktickit-lab4-e2e-uploads-20261028-52';
  const name = path.basename(root);
  if (!path.isAbsolute(root) || !name.startsWith('toktickit-') || !hasDisposableNameToken(name) || !name.split(/[_-]/).includes('uploads') || !['/private/tmp','/tmp'].includes(path.dirname(root))) {
    throw new Error('E2E uploads must use a dedicated absolute toktickit test directory under /private/tmp or /tmp');
  }
  if (existsSync(root) && lstatSync(root).isSymbolicLink()) throw new Error('Refusing a symlinked upload root');
  return root;
}
export async function unlinkTestUpload(file: string, root = assertSafeUploadsDir()) {
  root = assertSafeUploadsDir(root);
  const resolved = path.resolve(file), relative = path.relative(root, resolved);
  if (!relative || relative.startsWith('..') || path.isAbsolute(relative)) throw new Error('Refusing upload cleanup outside the dedicated test directory');
  // Resolve symlinks before deleting anything; missing fixture files are harmless.
  const canonicalRoot = await fs.realpath(root).catch(error => { if (error.code === 'ENOENT') return null; throw error; });
  const canonicalFile = await fs.realpath(resolved).catch(error => { if (error.code === 'ENOENT') return null; throw error; });
  if (!canonicalFile) return;
  const canonicalParent = await fs.realpath(path.dirname(root));
  if (canonicalRoot !== path.join(canonicalParent, path.basename(root))) throw new Error('Refusing a symlinked upload root');
  if (!canonicalRoot || path.relative(canonicalRoot, canonicalFile).startsWith('..')) throw new Error('Refusing symlink escape during upload cleanup');
  await fs.unlink(resolved);
}
