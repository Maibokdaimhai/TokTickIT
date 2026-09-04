import React, { useState } from "react";
import "./styles/theme.css";
import { RequesterProvider, useRequester } from "./context/RequesterContext.js";
import { Header } from "./components/Header.js";
import { RequesterSelectorModal } from "./components/RequesterSelectorModal.js";
import { CreateTicketForm } from "./components/CreateTicketForm.js";
import { MyTicketsPage } from "./components/MyTicketsPage.js";

const MainContent: React.FC = () => {
  const [activeTab, setActiveTab] = useState<"my-tickets" | "create-ticket">("my-tickets");

  return (
    <div style={{ minHeight: "100vh", backgroundColor: "var(--color-bg)" }}>
      <Header activeTab={activeTab} setActiveTab={setActiveTab} />
      <RequesterSelectorModal />

      <main style={{ maxWidth: "1200px", margin: "0 auto", padding: "24px 16px" }}>
        {activeTab === "my-tickets" && (
          <MyTicketsPage onNavigateToCreate={() => setActiveTab("create-ticket")} />
        )}

        {activeTab === "create-ticket" && (
          <CreateTicketForm
            onTicketCreated={() => {
              setActiveTab("my-tickets");
            }}
          />
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