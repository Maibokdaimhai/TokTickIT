import { app } from "./app.js";
import { ensureAuthReady } from "./services/auth.service.js";

const PORT = Number(process.env.PORT) || 3000;

ensureAuthReady().then(() => {
  app.listen(PORT, () => console.log(`TokTickIT API listening on http://localhost:${PORT}`));
}).catch(() => {
  console.error("Server startup blocked: verify migrations and run prisma:bootstrap.");
  process.exitCode = 1;
});
