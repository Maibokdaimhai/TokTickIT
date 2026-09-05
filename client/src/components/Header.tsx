import React from "react";
import { useRequester } from "../context/RequesterContext.js";
import { TokTickLogo } from "./TokTickLogo.js";

interface HeaderProps {
  activeTab: "my-tickets" | "create-ticket";
  setActiveTab: (tab: "my-tickets" | "create-ticket") => void;
}

export const Header: React.FC<HeaderProps> = ({ activeTab, setActiveTab }) => {
  const { selectedRequester, openSelector } = useRequester();

  const getInitials = (name: string) => {
    return name
      .split(" ")
      .map((part) => part[0])
      .join("")
      .toUpperCase()
      .slice(0, 2);
  };

  return (
    <header className="app-header">
      <div
        className="app-brand"
        onClick={() => setActiveTab("my-tickets")}
        role="button"
        tabIndex={0}
        onKeyDown={(e) => {
          if (e.key === "Enter" || e.key === " ") {
            setActiveTab("my-tickets");
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
          <div className="requester-avatar">
            {selectedRequester ? getInitials(selectedRequester.name) : "👤"}
          </div>
          <div className="requester-info-block">
            <span className="requester-name">
              {selectedRequester ? selectedRequester.name : "Select User"}
            </span>
            {selectedRequester && (
              <span className="requester-dept">{selectedRequester.department}</span>
            )}
          </div>
          <span style={{ fontSize: "10px", opacity: 0.8, marginLeft: "4px" }}>▼</span>
        </button>
      </nav>
    </header>
  );
};
