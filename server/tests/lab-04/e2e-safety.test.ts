import { describe, it, expect } from 'vitest';
import fs from 'node:fs/promises';
import { randomUUID } from 'node:crypto';
import { validateDatabaseUrl } from '../../../e2e/lab-03/db-guard.js';
import { assertSafeUploadsDir, unlinkTestUpload } from '../../../e2e/lab-03/upload-guard.js';

describe('Cross-lab E2E safety',()=>{
 it.each(['mysql://host/test_db','postgresql://host/%ZZ','postgresql://host/toktickit?test=1','postgresql://host/production'])('rejects unsafe or malformed database target %s',url=>expect(validateDatabaseUrl(url,'1').valid).toBe(false));
 it('requires explicit opt-in and accepts only the disposable pathname',()=>{
  expect(validateDatabaseUrl('postgresql://host/toktickit_test','0').valid).toBe(false);
  expect(validateDatabaseUrl('postgresql://host/toktickit_test','1').valid).toBe(true);
 });
 it.each(['/Users/meng/uploads','relative/test','/private/tmp','/private/tmp/uploads'])('rejects unsafe upload roots %s',root=>expect(()=>assertSafeUploadsDir(root)).toThrow());
 it('cannot unlink outside its root or escape through symlinks',async()=>{
  const root='/private/tmp/toktickit-e2e-uploads-'+randomUUID(),outside='/private/tmp/toktickit-outside-'+randomUUID();
  await fs.mkdir(root);await fs.writeFile(outside,'must survive');await fs.symlink(outside,root+'/escape');
  try{
   await expect(unlinkTestUpload(outside,root)).rejects.toThrow();
   await expect(unlinkTestUpload(root+'/escape',root)).rejects.toThrow();
   expect(await fs.readFile(outside,'utf8')).toBe('must survive');
   await fs.writeFile(root+'/own.txt','fixture');await unlinkTestUpload(root+'/own.txt',root);
   await expect(fs.access(root+'/own.txt')).rejects.toThrow();
  }finally{await fs.rm(root,{recursive:true,force:true});await fs.unlink(outside);}
 });
 it('rejects a root-directory symlink rather than treating its destination as test-owned',async()=>{
  const id=randomUUID(),root='/private/tmp/toktickit-e2e-uploads-'+id,target='/private/tmp/toktickit-external-directory-'+id;
  await fs.mkdir(target);await fs.writeFile(target+'/retain.txt','must survive');await fs.symlink(target,root);
  try{expect(()=>assertSafeUploadsDir(root)).toThrow();await expect(unlinkTestUpload(root+'/retain.txt',root)).rejects.toThrow();expect(await fs.readFile(target+'/retain.txt','utf8')).toBe('must survive');}
  finally{await fs.unlink(root);await fs.rm(target,{recursive:true,force:true});}
 });

});
