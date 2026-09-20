import React from "react";
import { useAuth } from "../context/AuthContext.js";
import { TokTickLogo } from "./TokTickLogo.js";

interface HeaderProps {
  activeTab: "my-tickets" | "create-ticket" | "ticket-queue" | "user-management";
  setActiveTab: (tab: "my-tickets" | "create-ticket" | "ticket-queue" | "user-management") => void;
  onChangePassword: () => void;
}

export const Header: React.FC<HeaderProps> = ({ activeTab, setActiveTab, onChangePassword }) => {
  const { session, logout } = useAuth();
  const selectedRequester = session?.user;
  const [error, setError] = React.useState("");
  const [menuOpen, setMenuOpen] = React.useState(false);
  const [signingOut, setSigningOut] = React.useState(false);
  const accountButton = React.useRef<HTMLButtonElement>(null);

  const getInitials = (name: string) => {
    return name
      .split(" ")
      .map((part) => part[0])
      .join("")
      .toUpperCase()
      .slice(0, 2);
  };

  const handleBrandClick = () => {
    if (session?.user.role === "IT_STAFF") {
      setActiveTab("ticket-queue");
    } else if (session?.user.role === "ADMINISTRATOR") {
      setActiveTab("user-management");
    } else {
      setActiveTab("my-tickets");
    }
  };

  return (
    <header className="app-header">
      <div
        className="app-brand"
        onClick={handleBrandClick}
        role="button"
        tabIndex={0}
        onKeyDown={(e) => {
          if (e.key === "Enter" || e.key === " ") {
            handleBrandClick();
          }
        }}
        title="TokTickIT Home"
      >
        <TokTickLogo size={36} />
        <div className="brand-text-block">
          <span className="brand-title">TokTickIT</span>
          <span className="brand-tagline">Enterprise Service Desk</span>
        </div>
      </div>

      <nav className="app-nav" aria-label="Main Navigation">
        {session?.user.role === "REQUESTER" && (
          <>
            <button
              type="button"
              className={`nav-item ${activeTab === "my-tickets" ? "active" : ""}`}
              onClick={() => setActiveTab("my-tickets")}
            >
              📋 My Tickets
            </button>

            <button
              type="button"
              className={`nav-item ${activeTab === "create-ticket" ? "active" : ""}`}
              onClick={() => setActiveTab("create-ticket")}
            >
              ➕ Create Ticket
            </button>
          </>
        )}

        {session?.user.role === "IT_STAFF" && (
          <button
            type="button"
            data-testid="nav-ticket-queue"
            className={`nav-item ${activeTab === "ticket-queue" ? "active" : ""}`}
            onClick={() => setActiveTab("ticket-queue")}
          >
            🎫 Ticket Queue
          </button>
        )}

        {session?.user.role === "ADMINISTRATOR" && (
          <>
            <button
              type="button"
              data-testid="nav-user-management"
              className={`nav-item ${activeTab === "user-management" ? "active" : ""}`}
              onClick={() => setActiveTab("user-management")}
            >
              👥 User Management
            </button>
            <button
              type="button"
              data-testid="nav-ticket-queue"
              className={`nav-item ${activeTab === "ticket-queue" ? "active" : ""}`}
              onClick={() => setActiveTab("ticket-queue")}
            >
              🎫 Ticket Queue
            </button>
          </>
        )}

        <div className="account-menu" onKeyDown={event => { if (event.key === "Escape") { setMenuOpen(false); accountButton.current?.focus(); } }}>
        <button
          ref={accountButton}
          type="button"
          className="requester-badge-btn"
          onClick={() => setMenuOpen(value => !value)}
          title="Account menu"
          aria-label="Account menu"
          aria-expanded={menuOpen}
          aria-controls="account-actions"
        >
          <div className="requester-avatar">
            {selectedRequester ? getInitials(selectedRequester.name) : "👤"}
          </div>
          <div className="requester-info-block">
            <span className="requester-name">
              {selectedRequester ? selectedRequester.name : "Select User"}
            </span>
            {selectedRequester && (
              <span className="requester-dept">{selectedRequester.role}</span>
            )}
          </div>
          <span style={{ fontSize: "10px", opacity: 0.8, marginLeft: "4px" }}>▼</span>
        </button>
        {menuOpen && <div id="account-actions" className="account-actions">
          <button className="btn btn-outline-secondary" type="button" onClick={() => { setMenuOpen(false); onChangePassword(); }}>Change password</button>
          <button className="btn btn-outline-secondary" type="button" disabled={signingOut} onClick={() => {
            setSigningOut(true); void logout().catch(reason => setError(reason.message)).finally(() => setSigningOut(false));
          }}>{signingOut ? "Signing out…" : "Sign out"}</button>
        </div>}
        </div>
        {error && <span role="alert">{error}</span>}
      </nav>
    </header>
  );
};
