import "../src/config.js";
import { bootstrapPasswords } from "./bootstrap-passwords.js";
import { getPrisma } from "../src/prisma.js";

const password = process.env.LAB3_INITIAL_PASSWORD;
if (!password) {
  console.error("Set LAB3_INITIAL_PASSWORD locally before running the bootstrap.");
  process.exitCode = 1;
} else {
  bootstrapPasswords(password).then(count => console.log(`Initialized ${count} migrated account(s). Existing passwords were preserved.`))
    .catch(() => { console.error("Password bootstrap failed. Check password rules and migration state."); process.exitCode = 1; })
    .finally(() => getPrisma().$disconnect());
}
