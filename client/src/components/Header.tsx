import React from "react";
import { useRequester } from "../context/RequesterContext.js";

interface HeaderProps {
  activeTab: "my-tickets" | "create-ticket";
  setActiveTab: (tab: "my-tickets" | "create-ticket") => void;
}

export const Header: React.FC<HeaderProps> = ({ activeTab, setActiveTab }) => {
  const { selectedRequester, openSelector } = useRequester();

  return (
    <header className="app-header">
      <div className="app-brand">
        <span style={{ fontSize: "22px" }}>🎫</span>
        <span>TokTickIT</span>
      </div>

      <nav className="app-nav">
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

        <button
          type="button"
          className="requester-badge-btn"
          onClick={openSelector}
          title="Click to switch Development Requester identity"
          aria-label="Current Requester Identity"
        >
          <span>👤 {selectedRequester ? selectedRequester.name : "Select User"}</span>
          <span style={{ fontSize: "10px" }}>▼</span>
        </button>
      </nav>
    </header>
  );
};
