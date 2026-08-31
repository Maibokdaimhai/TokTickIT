import React, { useState, useEffect } from "react";
import { useRequester } from "../context/RequesterContext.js";
import { fetchRequesters } from "../api.js";
import { RequesterUser } from "../types.js";

export const RequesterSelectorModal: React.FC = () => {
  const { selectedRequester, setSelectedRequester, isSelectorOpen, closeSelector } = useRequester();
  const [requesters, setRequesters] = useState<RequesterUser[]>([]);
  const [selectedId, setSelectedId] = useState<number | "">("");
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!isSelectorOpen) return;

    let mounted = true;
    setLoading(true);
    setError(null);

    fetchRequesters()
      .then((data) => {
        if (!mounted) return;
        setRequesters(data);
        if (selectedRequester) {
          setSelectedId(selectedRequester.id);
        } else if (data.length > 0) {
          setSelectedId(data[0].id);
        }
        setLoading(false);
      })
      .catch((err) => {
        if (!mounted) return;
        setError(err.message || "Failed to load development requesters");
        setLoading(false);
      });

    return () => {
      mounted = false;
    };
  }, [isSelectorOpen, selectedRequester]);

  if (!isSelectorOpen) return null;

  const handleConfirm = () => {
    const chosen = requesters.find((r) => r.id === Number(selectedId));
    if (chosen) {
      setSelectedRequester(chosen);
      closeSelector();
    }
  };

  return (
    <div className="modal-backdrop" role="dialog" aria-labelledby="modal-title" aria-modal="true">
      <div className="modal-card">
        <div className="modal-header">
          <h2 id="modal-title">Select Development Requester</h2>
          <p style={{ fontSize: "13px", color: "var(--color-text-secondary)" }}>
            Choose a development requester identity to simulate multi-user ticket ownership.
          </p>
        </div>

        <div className="modal-body">
          {/* Lab 2 Testing Disclaimer Banner */}
          <div className="disclaimer-banner" role="note">
            <span style={{ fontSize: "16px" }}>ℹ️</span>
            <div>
              <strong>Testing Identity Context Only:</strong> This selector simulates user login for Lab 2 testing. Authentication and role-based security will be introduced in Lab 3.
            </div>
          </div>

          {loading && (
            <div style={{ textAlign: "center", padding: "20px" }}>
              <span>Loading active requesters...</span>
            </div>
          )}

          {error && (
            <div className="form-error-msg" style={{ padding: "10px", backgroundColor: "#FEE2E2", borderRadius: "6px" }}>
              ⚠️ {error}
            </div>
          )}

          {!loading && !error && requesters.length === 0 && (
            <div style={{ textAlign: "center", padding: "16px", color: "var(--color-text-secondary)" }}>
              No active development requesters found in the database. Please run database seed.
            </div>
          )}

          {!loading && !error && requesters.length > 0 && (
            <div className="form-group">
              <label htmlFor="requester-select" className="form-label">
                Development Requester <span className="required-star">*</span>
              </label>
              <select
                id="requester-select"
                className="form-select"
                value={selectedId}
                onChange={(e) => setSelectedId(Number(e.target.value))}
              >
                {requesters.map((r) => (
                  <option key={r.id} value={r.id}>
                    {r.name} ({r.department}) — {r.email}
                  </option>
                ))}
              </select>
            </div>
          )}

          <div style={{ display: "flex", justifyContent: "flex-end", gap: "12px", marginTop: "24px" }}>
            {selectedRequester && (
              <button type="button" className="btn-secondary" onClick={closeSelector}>
                Cancel
              </button>
            )}
            <button
              type="button"
              className="btn-primary"
              onClick={handleConfirm}
              disabled={loading || requesters.length === 0 || !selectedId}
            >
              Continue
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
