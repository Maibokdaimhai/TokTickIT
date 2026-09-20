import React, { createContext, useContext, useEffect, useState } from "react";
import * as api from "../api.js";
import type { AuthResult } from "../types.js";

interface AuthContextValue {
  session: AuthResult | null;
  loading: boolean;
  error: string;
  login: (email: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
  changePassword: (currentPassword: string, newPassword: string, confirmPassword: string) => Promise<void>;
}
const AuthContext = createContext<AuthContextValue | undefined>(undefined);
export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [session, setSession] = useState<AuthResult | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  useEffect(() => {
    let active = true;
    // Retire the development selector. Never restore an identity from browser storage.
    localStorage.removeItem("toktickit_selected_requester_id");
    const expired = () => { setSession(null); setError("Your session has ended. Please sign in again."); };
    const required = () => setSession(value => value ? { ...value, mustChangePassword: true } : null);
    window.addEventListener("auth:expired", expired);
    window.addEventListener("auth:password-required", required);
    api.getSession().then(value => { if (active) setSession(value); })
      .catch(reason => { if (active && !(reason instanceof api.AuthError && reason.status === 401)) setError("Unable to check your session. Please try signing in."); })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; window.removeEventListener("auth:expired", expired); window.removeEventListener("auth:password-required", required); };
  }, []);
  const value: AuthContextValue = {
    session, loading, error,
    login: async (email, password) => { const result = await api.login(email, password); setError(""); setSession(result); },
    logout: async () => { await api.logout(); setSession(null); setError(""); },
    changePassword: async (currentPassword, newPassword, confirmPassword) => {
      const result = await api.changePassword(currentPassword, newPassword, confirmPassword);
      setSession(result); setError("");
    },
  };
  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}
export function useAuth() {
  const value = useContext(AuthContext);
  if (!value) throw new Error("useAuth must be used within AuthProvider");
  return value;
}
