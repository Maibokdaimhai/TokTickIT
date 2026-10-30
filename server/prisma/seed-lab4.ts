import "../src/config.js";
import { getPrisma } from "../src/prisma.js";
import { seedLab4Data } from "./seed-lab4-data.js";

seedLab4Data().then(result => console.log("Lab 4 fixture coverage:", result))
  .catch(() => { console.error("Lab 4 seed failed. Check migrations and eligible Lab 3 fixtures."); process.exitCode = 1; })
  .finally(() => getPrisma().$disconnect());
