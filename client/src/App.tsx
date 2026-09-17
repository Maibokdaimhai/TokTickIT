import React, { useState } from "react";
import "./styles/theme.css";
import { RequesterProvider, useRequester } from "./context/RequesterContext.js";
import { Header } from "./components/Header.js";
import { AuthProvider, useAuth } from "./context/AuthContext.js";
import { AuthPage } from "./components/AuthPage.js";
import { CreateTicketForm } from "./components/CreateTicketForm.js";
import { MyTicketsPage } from "./components/MyTicketsPage.js";
import { TicketDetailPage } from "./components/TicketDetailPage.js";
import { StaffTicketQueue } from "./components/StaffTicketQueue.js";
import { FetchStaffTicketsParams } from "./types.js";

type TabType = "my-tickets" | "create-ticket" | "ticket-queue" | "user-management";

const MainContent: React.FC = () => {
  const { session } = useAuth();
  const getInitialTab = (): TabType => {
    if (session?.user.role === "IT_STAFF") return "ticket-queue";
    if (session?.user.role === "ADMINISTRATOR") return "user-management";
    return "my-tickets";
  };

  const [activeTab, setActiveTab] = useState<TabType>(getInitialTab);
  const [selectedTicketId, setSelectedTicketId] = useState<number | undefined>(undefined);
  const [staffQueueParams, setStaffQueueParams] = useState<FetchStaffTicketsParams>({
    page: 1,
    limit: 10,
    sort: "updatedAt_desc",
  });
  const { selectedRequester } = useRequester();
  const [changingPassword, setChangingPassword] = useState(false);

  // Reset selected ticket if requester identity changes
  React.useEffect(() => {
    setSelectedTicketId(undefined);
  }, [selectedRequester?.id]);

  const handleTabChange = (tab: TabType) => {
    setActiveTab(tab);
    setSelectedTicketId(undefined);
  };

  if (changingPassword) return <AuthPage change onDone={() => setChangingPassword(false)} />;
  return (
    <div style={{ minHeight: "100vh", backgroundColor: "var(--color-bg)" }}>
      <Header activeTab={activeTab} setActiveTab={handleTabChange} onChangePassword={() => setChangingPassword(true)} />

      <main style={{ maxWidth: "1200px", margin: "0 auto", padding: "24px 16px" }}>
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

        {(session?.user.role === "IT_STAFF" || session?.user.role === "ADMINISTRATOR") && activeTab === "ticket-queue" && !selectedTicketId && (
          <StaffTicketQueue
            initialParams={staffQueueParams}
            onParamsChange={setStaffQueueParams}
            onOpenTicket={(id) => setSelectedTicketId(id)}
          />
        )}

        {(session?.user.role === "IT_STAFF" || session?.user.role === "ADMINISTRATOR") && activeTab === "ticket-queue" && selectedTicketId && (
          <div className="ticket-detail-container" data-testid="ticket-detail-placeholder" style={{ padding: "24px" }}>
            <button
              type="button"
              className="btn btn-outline-secondary"
              onClick={() => setSelectedTicketId(undefined)}
              style={{ marginBottom: "16px" }}
            >
              ← Back to Ticket Queue
            </button>
            <h2>Ticket #{selectedTicketId}</h2>
            <div className="alert alert-info" role="status" style={{ marginTop: "16px" }}>
              Ticket operations, comments, and internal notes belong to Issue #30.
            </div>
          </div>
        )}

        {session?.user.role === "ADMINISTRATOR" && activeTab === "user-management" && (
          <div data-testid="user-management-placeholder" role="status" style={{ padding: "24px" }}>
            <h2>User Management</h2>
            <p>Administrator user management workspace will be added in Issue #31.</p>
          </div>
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
