import React, { createContext, useContext, useState } from "react";
import { RequesterContext } from "../src/context/RequesterContext.js";
import type { RequesterUser } from "../src/types.js";

// Test-only presentation fixture preserves the older race/identity regressions.
// Production identity is supplied exclusively by AuthProvider, never this storage.
const SwitchContext = createContext<(user: RequesterUser | null) => void>(() => {});
export function RequesterProvider({ children }: { children: React.ReactNode }) {
  const [selectedRequester, setSelectedRequester] = useState<RequesterUser | null>(() => JSON.parse(localStorage.getItem("toktickit_selected_requester_id") ?? "null"));
  return <SwitchContext.Provider value={setSelectedRequester}><RequesterContext.Provider value={{ selectedRequester, openSelector: () => {} }}>{children}</RequesterContext.Provider></SwitchContext.Provider>;
}
export const useRequester = () => ({ setSelectedRequester: useContext(SwitchContext) });
