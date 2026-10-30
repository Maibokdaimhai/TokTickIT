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
import { UserManagement } from "./components/UserManagement.js";
import { Dashboard, MyActiveActions } from "./components/Dashboard.js";
import { readTicketQuery, rememberTicketQuery, ticketListState, ticketListReturn } from "./utils/ticket-query.js";

type TabType = "dashboard" | "my-tickets" | "create-ticket" | "ticket-queue" | "user-management";

interface MainContentProps {
  pathname: string;
  search: string;
  navigate: (path: string, replace?: boolean, state?: unknown) => void;
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

const MainContent: React.FC<MainContentProps> = ({ pathname, search, navigate }) => {
  const { session } = useAuth();
  const { selectedRequester } = useRequester();

  const savedReturn = session ? ticketListReturn(session.user) : null;
  const staffListQuery = React.useRef(savedReturn?.startsWith("/staff/tickets?") ? savedReturn.slice("/staff/tickets".length) : "");
  const requesterListQuery = React.useRef(savedReturn?.startsWith("/my-tickets?") ? savedReturn.slice("/my-tickets".length) : "");
  const role = session?.user.role;
  const getHomePath = () => {
    return role === "REQUESTER" ? "/dashboard" : "/staff/dashboard";
  };
  const homePath = getHomePath();

  let activeTab: TabType = "dashboard";
  if (pathname === "/staff/actions" || pathname === "/staff/tickets" || pathname.startsWith("/staff/tickets/")) {
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
      case "dashboard":
        navigate(homePath);
        break;
      case "ticket-queue":
        navigate("/staff/tickets" + staffListQuery.current);
        break;
      case "user-management":
        navigate("/admin/users");
        break;
      case "create-ticket":
        navigate("/tickets/new");
        break;
      case "my-tickets":
      default:
        navigate("/my-tickets" + requesterListQuery.current);
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
        {(pathname === "/dashboard" || pathname === "/staff/dashboard") && (
          (pathname === "/dashboard" && role === "REQUESTER") || (pathname === "/staff/dashboard" && (role === "IT_STAFF" || role === "ADMINISTRATOR")) ?
            <Dashboard staff={role !== "REQUESTER"} navigate={navigate} /> : <ForbiddenView message="This Dashboard is not available for your role." onHome={() => navigate(homePath)} />
        )}
        {pathname === "/staff/actions" && (role === "IT_STAFF" || role === "ADMINISTRATOR" ? <MyActiveActions search={search} navigate={navigate} /> : <ForbiddenView message="Actions are available to Staff and Administrators." onHome={() => navigate(homePath)} />)}
        {pathname === "/change-password" && (
          <AuthPage change onDone={() => navigate(homePath)} />
        )}

        {/* 1. Staff Ticket Queue */}
        {pathname === "/staff/tickets" && (
          role === "IT_STAFF" || role === "ADMINISTRATOR" ? (
            (() => { try { return <StaffTicketQueue key={search} initialParams={readTicketQuery(search, true)} onParamsChange={p => { rememberTicketQuery("/staff/tickets", p); staffListQuery.current = window.location.search; }} onOpenTicket={id => navigate(`/staff/tickets/${id}`, false, ticketListState(session!.user))} />; }
              catch { return <div role="alert">Invalid Ticket filters. <button type="button" onClick={() => navigate("/staff/tickets", true)}>Clear filters</button></div>; } })()
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
                  actor={session?.user}
                  onBack={() => navigate(ticketListReturn(session!.user) ?? "/staff/tickets" + staffListQuery.current)}
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
            <UserManagement />
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
            (() => { try { return <MyTicketsPage key={search} initialParams={readTicketQuery(search, false)} onParamsChange={p => { rememberTicketQuery("/my-tickets", p); requesterListQuery.current = window.location.search; }} onNavigateToCreate={() => navigate("/tickets/new")} onSelectTicket={id => navigate(`/tickets/${id}`, false, ticketListState(session!.user))} />; }
              catch { return <div role="alert">Invalid Ticket filters. <button type="button" onClick={() => navigate("/my-tickets", true)}>Clear filters</button></div>; } })()
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
                  onBack={() => navigate(ticketListReturn(session!.user) ?? "/my-tickets" + requesterListQuery.current)}
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
        {pathname !== "/dashboard" && pathname !== "/staff/dashboard" && pathname !== "/staff/actions" && pathname !== "/change-password" &&
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
  const [search, setSearch] = useState(() => window.location.search);
  const acceptedLocation = React.useRef(window.location.pathname + window.location.search);
  const acceptedState = React.useRef(window.history.state);

  useEffect(() => { acceptedLocation.current = window.location.pathname + window.location.search; acceptedState.current = window.history.state; }, [pathname]);

  const getHomePath = () => {
    return session?.user.role === "REQUESTER" ? "/dashboard" : "/staff/dashboard";
  };

  useEffect(() => {
    const onPopState = () => {
      if (!window.dispatchEvent(new Event("app:before-navigate", { cancelable: true }))) {
        window.history.pushState(acceptedState.current, "", acceptedLocation.current);
        return;
      }
      acceptedLocation.current = window.location.pathname + window.location.search;
      acceptedState.current = window.history.state;
      setPathname(window.location.pathname || "/");
      setSearch(window.location.search);
    };
    const rememberLocation = () => { acceptedLocation.current = window.location.pathname + window.location.search; acceptedState.current = window.history.state; };
    window.addEventListener("popstate", onPopState);
    window.addEventListener("app:location-changed", rememberLocation);
    return () => { window.removeEventListener("popstate", onPopState); window.removeEventListener("app:location-changed", rememberLocation); };
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

  const navigate = (newPath: string, replace = false, state: unknown = null) => {
    if (newPath !== window.location.pathname + window.location.search && !window.dispatchEvent(new Event("app:before-navigate", { cancelable: true }))) return;
    if (replace) {
      window.history.replaceState(state, "", newPath);
    } else {
      window.history.pushState(state, "", newPath);
    }
    setPathname(window.location.pathname);
    setSearch(window.location.search);
    acceptedLocation.current = window.location.pathname + window.location.search;
    acceptedState.current = window.history.state;
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
        search={search}
        navigate={navigate}
      />
    </RequesterProvider>
  );
}
