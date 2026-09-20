import "../src/config.js";
import { getPrisma } from "../src/prisma.js";
import { seedData } from "./seed-data.js";

const password = process.env.LAB3_INITIAL_PASSWORD;
if (!password) {
  console.error("Set LAB3_INITIAL_PASSWORD locally before seeding.");
  process.exitCode = 1;
} else {
  seedData(password).then(result => console.log("Lab 3 fixture coverage:", result))
    .catch(() => { console.error("Seed failed. Verify bootstrap, password rules, and fixture identity collisions."); process.exitCode = 1; })
    .finally(() => getPrisma().$disconnect());
}
