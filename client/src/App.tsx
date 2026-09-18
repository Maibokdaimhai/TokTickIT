import React, { useState, useEffect } from "react";
import "./styles/theme.css";
import { RequesterProvider, useRequester } from "./context/RequesterContext.js";
import { Header } from "./components/Header.js";
import { AuthProvider, useAuth } from "./context/AuthContext.js";
import { AuthPage } from "./components/AuthPage.js";
import { CreateTicketForm } from "./components/CreateTicketForm.js";
import { MyTicketsPage } from "./components/MyTicketsPage.js";
import { TicketDetailPage } from "./components/TicketDetailPage.js";
import { StaffTicketQueue } from "./components/StaffTicketQueue.js";
import { StaffTicketDetail } from "./components/StaffTicketDetail.js";
import { FetchStaffTicketsParams } from "./types.js";

type TabType = "my-tickets" | "create-ticket" | "ticket-queue" | "user-management";

interface MainContentProps {
  pathname: string;
  navigate: (path: string, replace?: boolean) => void;
}

const parsePositiveId = (val: string): number | null => {
  if (!/^\d+$/.test(val)) return null;
  const num = Number(val);
  if (num <= 0 || num > 2147483647) return null;
  return num;
};

const ForbiddenView: React.FC<{ message: string; onHome: () => void }> = ({ message, onHome }) => (
  <div
    data-testid="route-forbidden"
    style={{
      padding: "32px 24px",
      maxWidth: "600px",
      margin: "40px auto",
      backgroundColor: "#FEF2F2",
      border: "1px solid #FCA5A5",
      borderRadius: "8px",
      textAlign: "center",
      color: "#991B1B",
    }}
  >
    <h2 style={{ fontSize: "18px", fontWeight: 700, marginBottom: "8px" }}>Access Denied (403)</h2>
    <p style={{ fontSize: "14px", marginBottom: "16px" }}>{message}</p>
    <button
      type="button"
      onClick={onHome}
      style={{
        padding: "8px 16px",
        backgroundColor: "var(--color-primary)",
        color: "white",
        border: "none",
        borderRadius: "6px",
        fontWeight: 600,
        cursor: "pointer",
      }}
    >
      Return to Permitted Home
    </button>
  </div>
);

const InvalidTicketView: React.FC<{ onHome: () => void }> = ({ onHome }) => (
  <div
    data-testid="route-invalid-ticket"
    style={{
      padding: "32px 24px",
      maxWidth: "600px",
      margin: "40px auto",
      backgroundColor: "#FEF2F2",
      border: "1px solid #FCA5A5",
      borderRadius: "8px",
      textAlign: "center",
      color: "#991B1B",
    }}
  >
    <h2 style={{ fontSize: "18px", fontWeight: 700, marginBottom: "8px" }}>Invalid Ticket ID</h2>
    <p style={{ fontSize: "14px", marginBottom: "16px" }}>
      The ticket ID must be a positive integer. Please verify the URL or return home.
    </p>
    <button
      type="button"
      onClick={onHome}
      style={{
        padding: "8px 16px",
        backgroundColor: "var(--color-primary)",
        color: "white",
        border: "none",
        borderRadius: "6px",
        fontWeight: 600,
        cursor: "pointer",
      }}
    >
      Return Home
    </button>
  </div>
);

const NotFoundView: React.FC<{ pathname: string; onHome: () => void }> = ({ pathname, onHome }) => (
  <div
    data-testid="route-not-found"
    style={{
      padding: "32px 24px",
      maxWidth: "600px",
      margin: "40px auto",
      backgroundColor: "#F8FAFC",
      border: "1px solid #CBD5E1",
      borderRadius: "8px",
      textAlign: "center",
      color: "#475569",
    }}
  >
    <h2 style={{ fontSize: "18px", fontWeight: 700, marginBottom: "8px" }}>Page Not Found (404)</h2>
    <p style={{ fontSize: "14px", marginBottom: "16px" }}>
      The page you requested (<code>{pathname}</code>) does not exist.
    </p>
    <button
      type="button"
      data-testid="btn-not-found-home"
      onClick={onHome}
      style={{
        padding: "8px 16px",
        backgroundColor: "var(--color-primary)",
        color: "white",
        border: "none",
        borderRadius: "6px",
        fontWeight: 600,
        cursor: "pointer",
      }}
    >
      Return Home
    </button>
  </div>
);

const MainContent: React.FC<MainContentProps> = ({ pathname, navigate }) => {
  const { session } = useAuth();
  const { selectedRequester } = useRequester();
  const [staffQueueParams, setStaffQueueParams] = useState<FetchStaffTicketsParams>({
    page: 1,
    limit: 10,
    sort: "updatedAt_desc",
  });

  const role = session?.user.role;
  const getHomePath = () => {
    if (role === "IT_STAFF") return "/staff/tickets";
    if (role === "ADMINISTRATOR") return "/admin/users";
    return "/my-tickets";
  };
  const homePath = getHomePath();

  let activeTab: TabType = "my-tickets";
  if (pathname === "/staff/tickets" || pathname.startsWith("/staff/tickets/")) {
    activeTab = "ticket-queue";
  } else if (pathname === "/admin/users") {
    activeTab = "user-management";
  } else if (pathname === "/tickets/new") {
    activeTab = "create-ticket";
  } else if (pathname === "/my-tickets" || pathname.startsWith("/tickets/")) {
    activeTab = "my-tickets";
  }

  const handleTabChange = (tab: TabType) => {
    switch (tab) {
      case "ticket-queue":
        navigate("/staff/tickets");
        break;
      case "user-management":
        navigate("/admin/users");
        break;
      case "create-ticket":
        navigate("/tickets/new");
        break;
      case "my-tickets":
      default:
        navigate("/my-tickets");
        break;
    }
  };

  // Reset ticket detail if requester changes
  const prevRequesterIdRef = React.useRef<number | undefined>(selectedRequester?.id);
  useEffect(() => {
    if (
      prevRequesterIdRef.current !== undefined &&
      prevRequesterIdRef.current !== selectedRequester?.id
    ) {
      if (pathname.startsWith("/tickets/")) {
        navigate("/my-tickets", true);
      }
    }
    prevRequesterIdRef.current = selectedRequester?.id;
  }, [selectedRequester?.id]);

  return (
    <div style={{ minHeight: "100vh", backgroundColor: "var(--color-bg)" }}>
      <Header
        activeTab={activeTab}
        setActiveTab={handleTabChange}
        onChangePassword={() => navigate("/change-password")}
      />

      <main style={{ maxWidth: "1200px", margin: "0 auto", padding: "24px 16px" }}>
        {/* Route Dispatching */}
        {pathname === "/change-password" && (
          <AuthPage change onDone={() => navigate(homePath)} />
        )}

        {/* 1. Staff Ticket Queue */}
        {pathname === "/staff/tickets" && (
          role === "IT_STAFF" || role === "ADMINISTRATOR" ? (
            <StaffTicketQueue
              initialParams={staffQueueParams}
              onParamsChange={setStaffQueueParams}
              onOpenTicket={(id) => navigate(`/staff/tickets/${id}`)}
            />
          ) : (
            <ForbiddenView
              message="You do not have permission to access the staff ticket queue."
              onHome={() => navigate(homePath)}
            />
          )
        )}

        {/* 2. Staff Ticket Detail */}
        {pathname.startsWith("/staff/tickets/") && (
          role === "IT_STAFF" || role === "ADMINISTRATOR" ? (
            (() => {
              const idStr = pathname.replace("/staff/tickets/", "");
              const ticketId = parsePositiveId(idStr);
              if (!ticketId) {
                return <InvalidTicketView onHome={() => navigate(homePath)} />;
              }
              return (
                <StaffTicketDetail
                  ticketId={ticketId}
                  onBack={() => navigate("/staff/tickets")}
                />
              );
            })()
          ) : (
            <ForbiddenView
              message="You do not have permission to access staff ticket operations."
              onHome={() => navigate(homePath)}
            />
          )
        )}

        {/* 3. Admin User Management */}
        {pathname === "/admin/users" && (
          role === "ADMINISTRATOR" ? (
            <div data-testid="user-management-placeholder" role="status" style={{ padding: "24px" }}>
              <h2>User Management</h2>
              <p>Administrator user management workspace will be added in Issue #31.</p>
            </div>
          ) : (
            <ForbiddenView
              message="You do not have permission to access user management."
              onHome={() => navigate(homePath)}
            />
          )
        )}

        {/* 4. Requester Tickets List */}
        {pathname === "/my-tickets" && (
          role === "REQUESTER" ? (
            <MyTicketsPage
              onNavigateToCreate={() => navigate("/tickets/new")}
              onSelectTicket={(id) => navigate(`/tickets/${id}`)}
            />
          ) : (
            <ForbiddenView
              message="Staff and administrators manage tickets through the staff queue."
              onHome={() => navigate(homePath)}
            />
          )
        )}

        {/* 5. Create Ticket */}
        {pathname === "/tickets/new" && (
          role === "REQUESTER" ? (
            <CreateTicketForm
              onTicketCreated={() => navigate("/my-tickets")}
            />
          ) : (
            <ForbiddenView
              message="Staff and administrators manage tickets through the staff queue."
              onHome={() => navigate(homePath)}
            />
          )
        )}

        {/* 6. Requester Ticket Detail */}
        {pathname.startsWith("/tickets/") && pathname !== "/tickets/new" && (
          role === "REQUESTER" ? (
            (() => {
              const idStr = pathname.replace("/tickets/", "");
              const ticketId = parsePositiveId(idStr);
              if (!ticketId) {
                return <InvalidTicketView onHome={() => navigate(homePath)} />;
              }
              return (
                <TicketDetailPage
                  ticketId={ticketId}
                  onBack={() => navigate("/my-tickets")}
                />
              );
            })()
          ) : (
            <ForbiddenView
              message="Staff and administrators manage tickets through the staff queue."
              onHome={() => navigate(homePath)}
            />
          )
        )}

        {/* 7. Unknown route */}
        {pathname !== "/change-password" &&
          pathname !== "/staff/tickets" &&
          !pathname.startsWith("/staff/tickets/") &&
          pathname !== "/admin/users" &&
          pathname !== "/my-tickets" &&
          pathname !== "/tickets/new" &&
          !pathname.startsWith("/tickets/") && (
            <NotFoundView pathname={pathname} onHome={() => navigate(homePath)} />
          )}
      </main>
    </div>
  );
};

export default function App() {
  return (
    <AuthProvider>
      <SessionGate />
    </AuthProvider>
  );
}

function SessionGate() {
  const { session, loading } = useAuth();
  const [pathname, setPathname] = useState<string>(() => window.location.pathname || "/");

  const getHomePath = () => {
    if (session?.user.role === "IT_STAFF") return "/staff/tickets";
    if (session?.user.role === "ADMINISTRATOR") return "/admin/users";
    return "/my-tickets";
  };

  useEffect(() => {
    const onPopState = () => {
      setPathname(window.location.pathname || "/");
    };
    window.addEventListener("popstate", onPopState);
    return () => window.removeEventListener("popstate", onPopState);
  }, []);

  useEffect(() => {
    if (loading) return;

    if (!session) {
      if (pathname !== "/login") {
        window.history.replaceState(null, "", "/login");
        setPathname("/login");
      }
      return;
    }

    if (session.mustChangePassword) {
      if (pathname !== "/change-password") {
        window.history.replaceState(null, "", "/change-password");
        setPathname("/change-password");
      }
      return;
    }

    if (pathname === "/" || pathname === "/login") {
      const home = getHomePath();
      window.history.replaceState(null, "", home);
      setPathname(home);
    }
  }, [loading, session, pathname]);

  const navigate = (newPath: string, replace = false) => {
    if (replace) {
      window.history.replaceState(null, "", newPath);
    } else {
      window.history.pushState(null, "", newPath);
    }
    setPathname(newPath);
  };

  if (loading) {
    return <main className="auth-page" role="status">Checking session…</main>;
  }

  if (!session) {
    return <AuthPage />;
  }

  if (session.mustChangePassword) {
    return (
      <AuthPage
        change
        onDone={() => {
          const home = getHomePath();
          navigate(home, true);
        }}
      />
    );
  }

  const activePathname = pathname === "/" || pathname === "/login" ? getHomePath() : pathname;

  return (
    <RequesterProvider>
      <MainContent
        key={session.user.id}
        pathname={activePathname}
        navigate={navigate}
      />
    </RequesterProvider>
  );
}
