import React, { createContext, useContext, useState, useEffect } from "react";
import { RequesterUser } from "../types.js";

interface RequesterContextType {
  selectedRequester: RequesterUser | null;
  setSelectedRequester: (user: RequesterUser | null) => void;
  isSelectorOpen: boolean;
  openSelector: () => void;
  closeSelector: () => void;
}

const RequesterContext = createContext<RequesterContextType | undefined>(undefined);

const LOCAL_STORAGE_KEY = "toktickit_selected_requester_id";

export const RequesterProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [selectedRequester, setSelectedRequesterState] = useState<RequesterUser | null>(null);
  const [isSelectorOpen, setIsSelectorOpen] = useState<boolean>(false);

  // Helper to update state and localStorage
  const setSelectedRequester = (user: RequesterUser | null) => {
    setSelectedRequesterState(user);
    if (user) {
      localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(user));
    } else {
      localStorage.removeItem(LOCAL_STORAGE_KEY);
    }
  };

  // Restore saved selection on load
  useEffect(() => {
    try {
      const saved = localStorage.getItem(LOCAL_STORAGE_KEY);
      if (saved) {
        const parsed = JSON.parse(saved);
        if (parsed && parsed.id) {
          setSelectedRequesterState(parsed);
        } else {
          setIsSelectorOpen(true);
        }
      } else {
        setIsSelectorOpen(true);
      }
    } catch {
      setIsSelectorOpen(true);
    }
  }, []);

  return (
    <RequesterContext.Provider
      value={{
        selectedRequester,
        setSelectedRequester,
        isSelectorOpen,
        openSelector: () => setIsSelectorOpen(true),
        closeSelector: () => setIsSelectorOpen(false),
      }}
    >
      {children}
    </RequesterContext.Provider>
  );
};

export const useRequester = (): RequesterContextType => {
  const context = useContext(RequesterContext);
  if (!context) {
    throw new Error("useRequester must be used within a RequesterProvider");
  }
  return context;
};
