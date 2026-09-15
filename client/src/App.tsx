import React, { useState } from "react";
import "./styles/theme.css";
import { RequesterProvider, useRequester } from "./context/RequesterContext.js";
import { Header } from "./components/Header.js";
import { AuthProvider, useAuth } from "./context/AuthContext.js";
import { AuthPage } from "./components/AuthPage.js";
import { CreateTicketForm } from "./components/CreateTicketForm.js";
import { MyTicketsPage } from "./components/MyTicketsPage.js";
import { TicketDetailPage } from "./components/TicketDetailPage.js";

const MainContent: React.FC = () => {
  const [activeTab, setActiveTab] = useState<"my-tickets" | "create-ticket">("my-tickets");
  const [selectedTicketId, setSelectedTicketId] = useState<number | undefined>(undefined);
  const { selectedRequester } = useRequester();
  const { session } = useAuth();
  const [changingPassword, setChangingPassword] = useState(false);

  // Reset selected ticket if requester identity changes
  React.useEffect(() => {
    setSelectedTicketId(undefined);
  }, [selectedRequester?.id]);

  const handleTabChange = (tab: "my-tickets" | "create-ticket") => {
    setActiveTab(tab);
    setSelectedTicketId(undefined);
  };

  if (changingPassword) return <AuthPage change onDone={() => setChangingPassword(false)} />;
  return (
    <div style={{ minHeight: "100vh", backgroundColor: "var(--color-bg)" }}>
      <Header activeTab={activeTab} setActiveTab={handleTabChange} onChangePassword={() => setChangingPassword(true)} />

      <main style={{ maxWidth: "1200px", margin: "0 auto", padding: "24px 16px" }}>
        {session?.user.role !== "REQUESTER" && <p role="status">Signed in as {session?.user.role}. Staff and administrator workspaces will be added in the next Sprint 3 issues.</p>}
        {session?.user.role === "REQUESTER" && activeTab === "my-tickets" && !selectedTicketId && (
          <MyTicketsPage
            onNavigateToCreate={() => handleTabChange("create-ticket")}
            onSelectTicket={(id) => setSelectedTicketId(id)}
          />
        )}

        {session?.user.role === "REQUESTER" && activeTab === "my-tickets" && selectedTicketId && (
          <TicketDetailPage
            ticketId={selectedTicketId}
            onBack={() => setSelectedTicketId(undefined)}
          />
        )}

        {session?.user.role === "REQUESTER" && activeTab === "create-ticket" && (
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
  return <AuthProvider><SessionGate /></AuthProvider>;
}
function SessionGate() {
  const { session, loading } = useAuth();
  if (loading) return <main className="auth-page" role="status">Checking session…</main>;
  if (!session) return <AuthPage />;
  if (session.mustChangePassword) return <AuthPage change />;
  return <RequesterProvider><MainContent key={session.user.id} /></RequesterProvider>;
}
