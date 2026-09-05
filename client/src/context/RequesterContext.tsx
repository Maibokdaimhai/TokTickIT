import React, { createContext, useContext, useState, useEffect } from "react";
import { RequesterUser } from "../types.js";
import { fetchRequesters } from "../api.js";

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

  // Restore & validate saved selection on startup
  useEffect(() => {
    let mounted = true;

    const initContext = async () => {
      try {
        const saved = localStorage.getItem(LOCAL_STORAGE_KEY);
        if (!saved) {
          if (mounted) setIsSelectorOpen(true);
          return;
        }

        const parsed = JSON.parse(saved);
        if (!parsed || !parsed.id) {
          if (mounted) {
            localStorage.removeItem(LOCAL_STORAGE_KEY);
            setIsSelectorOpen(true);
          }
          return;
        }

        // Validate saved user against currently active users
        const activeUsers = await fetchRequesters();
        if (!mounted) return;

        const activeMatch = activeUsers.find((u) => u.id === parsed.id);
        if (activeMatch) {
          setSelectedRequesterState(activeMatch);
        } else {
          // Saved user is no longer active
          localStorage.removeItem(LOCAL_STORAGE_KEY);
          setSelectedRequesterState(null);
          setIsSelectorOpen(true);
        }
      } catch {
        if (mounted) {
          localStorage.removeItem(LOCAL_STORAGE_KEY);
          setSelectedRequesterState(null);
          setIsSelectorOpen(true);
        }
      }
    };

    initContext();

    return () => {
      mounted = false;
    };
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
