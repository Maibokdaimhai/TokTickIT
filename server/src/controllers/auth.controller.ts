import * as auth from "../services/auth.service.js";
import { asyncHandler } from "../middleware/async-handler.js";
import { clearSessionCookie, readSessionToken, setSessionCookie } from "../utils/session.js";

export const login = asyncHandler(async (req, res) => {
  const result = await auth.login(req.body, readSessionToken(req));
  setSessionCookie(res, result.token);
  res.json(result.result);
}, "Unable to sign in");
export const logout = asyncHandler(async (req, res) => {
  await auth.logout(readSessionToken(req));
  clearSessionCookie(res);
  res.sendStatus(204);
}, "Unable to sign out");
export const me = asyncHandler(async (req, res) => {
  const session = await auth.currentSession(readSessionToken(req));
  res.json(auth.authResult(session.user));
}, "Unable to retrieve your session");
export const changePassword = asyncHandler(async (req, res) => {
  const result = await auth.changePassword(req.body, readSessionToken(req));
  setSessionCookie(res, result.token);
  res.json(result.result);
}, "Unable to change password");
