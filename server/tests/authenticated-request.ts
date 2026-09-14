import { beforeAll, afterAll } from "vitest";
import supertest from "supertest";
import { randomUUID } from "node:crypto";
import { getPrisma } from "../src/prisma.js";
import { digest, newSessionToken, SESSION_LIFETIME } from "../src/utils/session.js";
import { hashPassword } from "../src/utils/password.js";

// Existing endpoint regressions run behind a real persisted session. Auth-specific
// tests separately exercise issuance through login; no production middleware bypass.
const token = newSessionToken();
let userId: number;
export let testPasswordHash: string;
beforeAll(async () => {
  testPasswordHash = await hashPassword("Regression-only-pass1!");
  const user = await getPrisma().user.create({ data: {
    name: "Endpoint regression session", email: `${randomUUID()}@regression.example`,
    passwordHash: testPasswordHash, mustChangePassword: false,
  } });
  userId = user.id;
  await getPrisma().session.create({ data: { userId, tokenDigest: digest(token), expiresAt: new Date(Date.now() + SESSION_LIFETIME) } });
});
afterAll(async () => { if (userId) await getPrisma().user.delete({ where: { id: userId } }); });
export default function authenticatedRequest(app: Parameters<typeof supertest>[0]) {
  return supertest.agent(app).set("Origin", "http://localhost:5173").set("Cookie", `toktickit_session=${token}`);
}
