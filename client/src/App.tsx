import React, { useState } from "react";
import "./styles/theme.css";
import { RequesterProvider, useRequester } from "./context/RequesterContext.js";
import { Header } from "./components/Header.js";
import { RequesterSelectorModal } from "./components/RequesterSelectorModal.js";

const MainContent: React.FC = () => {
  const [activeTab, setActiveTab] = useState<"my-tickets" | "create-ticket">("my-tickets");
  const { selectedRequester } = useRequester();

  return (
    <div style={{ minHeight: "100vh", backgroundColor: "var(--color-bg)" }}>
      <Header activeTab={activeTab} setActiveTab={setActiveTab} />
      <RequesterSelectorModal />

      <main style={{ maxWidth: "1200px", margin: "0 auto", padding: "24px 16px" }}>
        {activeTab === "my-tickets" && (
          <div style={{ backgroundColor: "white", padding: "24px", borderRadius: "12px", border: "1px solid var(--color-border)" }}>
            <h1 style={{ fontSize: "20px", color: "var(--color-primary)", marginBottom: "8px" }}>📋 My Tickets</h1>
            <p style={{ color: "var(--color-text-secondary)", marginBottom: "16px" }}>
              Viewing support tickets owned by <strong>{selectedRequester ? selectedRequester.name : "No user selected"}</strong>.
            </p>
            <div style={{ padding: "16px", backgroundColor: "var(--color-pale-green)", borderRadius: "8px", border: "1px solid #CBD5E1" }}>
              ℹ️ Requester Context established! Ticket list component will be implemented in Issue 4.
            </div>
          </div>
        )}

        {activeTab === "create-ticket" && (
          <div style={{ backgroundColor: "white", padding: "24px", borderRadius: "12px", border: "1px solid var(--color-border)" }}>
            <h1 style={{ fontSize: "20px", color: "var(--color-primary)", marginBottom: "8px" }}>➕ Create Support Ticket</h1>
            <p style={{ color: "var(--color-text-secondary)", marginBottom: "16px" }}>
              Creating a new ticket as <strong>{selectedRequester ? selectedRequester.name : "No user selected"}</strong>.
            </p>
            <div style={{ padding: "16px", backgroundColor: "var(--color-pale-green)", borderRadius: "8px", border: "1px solid #CBD5E1" }}>
              ℹ️ Requester Context established! Create Ticket form component will be implemented in Issue 3.
            </div>
          </div>
        )}
      </main>
    </div>
  );
};

export default function App() {
  return (
    <RequesterProvider>
      <MainContent />
    </RequesterProvider>
  );
}