import React, { useState } from "react";
import "./styles/theme.css";
import { RequesterProvider, useRequester } from "./context/RequesterContext.js";
import { Header } from "./components/Header.js";
import { RequesterSelectorModal } from "./components/RequesterSelectorModal.js";
import { CreateTicketForm } from "./components/CreateTicketForm.js";
import { MyTicketsPage } from "./components/MyTicketsPage.js";
import { TicketDetailPage } from "./components/TicketDetailPage.js";

const MainContent: React.FC = () => {
  const [activeTab, setActiveTab] = useState<"my-tickets" | "create-ticket">("my-tickets");
  const [selectedTicketId, setSelectedTicketId] = useState<number | undefined>(undefined);
  const { selectedRequester } = useRequester();

  // Reset selected ticket if requester identity changes
  React.useEffect(() => {
    setSelectedTicketId(undefined);
  }, [selectedRequester?.id]);

  const handleTabChange = (tab: "my-tickets" | "create-ticket") => {
    setActiveTab(tab);
    setSelectedTicketId(undefined);
  };

  return (
    <div style={{ minHeight: "100vh", backgroundColor: "var(--color-bg)" }}>
      <Header activeTab={activeTab} setActiveTab={handleTabChange} />
      <RequesterSelectorModal />

      <main style={{ maxWidth: "1200px", margin: "0 auto", padding: "24px 16px" }}>
        {activeTab === "my-tickets" && !selectedTicketId && (
          <MyTicketsPage
            onNavigateToCreate={() => handleTabChange("create-ticket")}
            onSelectTicket={(id) => setSelectedTicketId(id)}
          />
        )}

        {activeTab === "my-tickets" && selectedTicketId && (
          <TicketDetailPage
            ticketId={selectedTicketId}
            onBack={() => setSelectedTicketId(undefined)}
          />
        )}

        {activeTab === "create-ticket" && (
          <CreateTicketForm
            onTicketCreated={() => {
              handleTabChange("my-tickets");
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