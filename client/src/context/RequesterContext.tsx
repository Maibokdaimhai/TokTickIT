import React, { createContext, useContext } from "react";
import type { RequesterUser } from "../types.js";
import { useAuth } from "./AuthContext.js";

// Presentation adapter for existing requester pages; identity comes only from /auth/me.
export const RequesterContext = createContext<{ selectedRequester: RequesterUser | null; openSelector: () => void } | undefined>(undefined);
export function RequesterProvider({ children }: { children: React.ReactNode }) {
  const { session } = useAuth();
  return <RequesterContext.Provider value={{ selectedRequester: session?.user ?? null, openSelector: () => {} }}>{children}</RequesterContext.Provider>;
}
export function useRequester() {
  const context = useContext(RequesterContext);
  if (!context) throw new Error("useRequester must be used within RequesterProvider");
  return context;
}
