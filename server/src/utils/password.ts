import bcrypt from "bcrypt";
import { validatePassword } from "../validators/auth.validator.js";

export async function hashPassword(password: string): Promise<string> {
  validatePassword(password);
  return bcrypt.hash(password, 12);
}

let dummyHash: Promise<string> | undefined;
export async function verifyPassword(password: string, hash?: string): Promise<boolean> {
  const usable = Buffer.byteLength(password, "utf8") <= 72 && !password.includes("\0");
  const target = hash ?? await (dummyHash ??= bcrypt.hash("Dummy-comparison-only1!", 12));
  const matches = await bcrypt.compare(usable ? password : "", target);
  return usable && Boolean(hash) && matches;
}
