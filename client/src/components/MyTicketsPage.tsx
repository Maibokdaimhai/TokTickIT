import React, { useState, useEffect, useRef } from "react";
import { useRequester } from "../context/RequesterContext.js";
import { fetchCategories, fetchMyTickets } from "../api.js";
import { Category, Priority, TicketStatus, Ticket, PaginationInfo } from "../types.js";

interface MyTicketsPageProps {
  onNavigateToCreate?: () => void;
}

export const MyTicketsPage: React.FC<MyTicketsPageProps> = ({ onNavigateToCreate }) => {
  const { selectedRequester, openSelector } = useRequester();

  // Reference data
  const [categories, setCategories] = useState<Category[]>([]);

  // Filter and pagination state
  const [search, setSearch] = useState<string>("");
  const [debouncedSearch, setDebouncedSearch] = useState<string>("");
  const [categoryId, setCategoryId] = useState<number | "">("");
  const [priority, setPriority] = useState<Priority | "">("");
  const [status, setStatus] = useState<TicketStatus | "">("");
  const [sort, setSort] = useState<"createdAt_desc" | "createdAt_asc" | "ticketNumber_asc" | "ticketNumber_desc">("createdAt_desc");
  const [page, setPage] = useState<number>(1);
  const limit = 10;

  // Track previous requester ID to reset page when requester changes
  const prevRequesterIdRef = useRef<number | undefined>(selectedRequester?.id);
  const [retryKey, setRetryKey] = useState<number>(0);
  const loadTickets = () => setRetryKey((k) => k + 1);

  // Tickets & loading state
  const [tickets, setTickets] = useState<Ticket[]>([]);
  const [pagination, setPagination] = useState<PaginationInfo | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  // Load categories on mount
  useEffect(() => {
    fetchCategories()
      .then((data) => setCategories(data))
      .catch(() => {
        // Silently fail or use empty list
      });
  }, []);

  // Debounce search input
  useEffect(() => {
    const handler = setTimeout(() => {
      setDebouncedSearch(search);
      setPage(1);
    }, 300);
    return () => clearTimeout(handler);
  }, [search]);

  // Reset page to 1 when filters change
  const handleCategoryChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    setCategoryId(e.target.value ? Number(e.target.value) : "");
    setPage(1);
  };

  const handlePriorityChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    setPriority(e.target.value ? (e.target.value as Priority) : "");
    setPage(1);
  };

  const handleStatusChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    setStatus(e.target.value ? (e.target.value as TicketStatus) : "");
    setPage(1);
  };

  const handleSortChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    setSort(e.target.value as any);
    setPage(1);
  };

  const clearFilters = () => {
    setSearch("");
    setDebouncedSearch("");
    setCategoryId("");
    setPriority("");
    setStatus("");
    setSort("createdAt_desc");
    setPage(1);
  };

  const hasActiveFilters = Boolean(
    debouncedSearch.trim() ||
    categoryId !== "" ||
    priority !== "" ||
    status !== "" ||
    sort !== "createdAt_desc"
  );

  // Fetch tickets for current requester with cancellation and stale response discard
  useEffect(() => {
    let isCancelled = false;
    const controller = new AbortController();

    if (!selectedRequester) {
      setLoading(false);
      setTickets([]);
      setPagination(null);
      return;
    }

    // If requester changed and page was not 1, reset page to 1 and wait for reset render
    if (prevRequesterIdRef.current !== selectedRequester.id) {
      prevRequesterIdRef.current = selectedRequester.id;
      if (page !== 1) {
        setPage(1);
        return;
      }
    }

    setLoading(true);
    setError(null);

    fetchMyTickets({
      requesterId: selectedRequester.id,
      search: debouncedSearch,
      category: categoryId === "" ? undefined : categoryId,
      priority: priority === "" ? undefined : priority,
      status: status === "" ? undefined : status,
      sort,
      page,
      limit,
      signal: controller.signal,
    })
      .then((res) => {
        if (!isCancelled) {
          setTickets(res.tickets);
          setPagination(res.pagination);
          setLoading(false);
        }
      })
      .catch((err: any) => {
        if (isCancelled || err?.name === "AbortError") {
          return;
        }
        setError(err.message || "Failed to load support tickets.");
        setLoading(false);
      });

    return () => {
      isCancelled = true;
      controller.abort();
    };
  }, [selectedRequester?.id, debouncedSearch, categoryId, priority, status, sort, page, retryKey]);

  // Helper badge formatters
  const renderPriorityBadge = (p: Priority) => {
    const classMap: Record<Priority, string> = {
      LOW: "badge-priority-low",
      MEDIUM: "badge-priority-medium",
      HIGH: "badge-priority-high",
      URGENT: "badge-priority-urgent",
    };
    return <span className={`badge ${classMap[p] || "badge-priority-medium"}`}>{p}</span>;
  };

  const renderStatusBadge = (s: TicketStatus) => {
    const classMap: Record<TicketStatus, string> = {
      NEW: "badge-status-new",
      IN_PROGRESS: "badge-status-in_progress",
      RESOLVED: "badge-status-resolved",
      CLOSED: "badge-status-closed",
    };
    const labelMap: Record<TicketStatus, string> = {
      NEW: "New",
      IN_PROGRESS: "In Progress",
      RESOLVED: "Resolved",
      CLOSED: "Closed",
    };
    return <span className={`badge ${classMap[s] || "badge-status-new"}`}>{labelMap[s] || s}</span>;
  };

  const formatDate = (isoStr: string) => {
    try {
      return isoStr.split("T")[0];
    } catch {
      return isoStr;
    }
  };

  return (
    <div style={{ backgroundColor: "white", padding: "24px", borderRadius: "12px", border: "1px solid var(--color-border)", boxShadow: "0 2px 8px rgba(0,0,0,0.03)" }}>
      {/* Header section */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: "20px", flexWrap: "wrap", gap: "14px" }}>
        <div>
          <div style={{ display: "flex", alignItems: "center", gap: "10px", marginBottom: "6px" }}>
            <h1 style={{ fontSize: "22px", fontWeight: "800", color: "var(--color-primary)", margin: 0 }}>
              📋 My Tickets
            </h1>
            {pagination && (
              <span
                style={{
                  fontSize: "12px",
                  fontWeight: "700",
                  backgroundColor: "var(--color-pale-green)",
                  color: "var(--color-primary)",
                  padding: "3px 10px",
                  borderRadius: "12px",
                  border: "1px solid rgba(0, 107, 60, 0.2)",
                }}
              >
                {pagination.totalItems} {pagination.totalItems === 1 ? "Ticket" : "Tickets"}
              </span>
            )}
          </div>
          <p style={{ color: "var(--color-text-secondary)", fontSize: "14px" }}>
            Viewing support tickets owned by{" "}
            <strong style={{ color: "var(--color-text-primary)" }}>{selectedRequester ? selectedRequester.name : "No user selected"}</strong>
            {selectedRequester && ` (${selectedRequester.department})`}.
          </p>
        </div>
        <div style={{ display: "flex", gap: "10px", alignItems: "center" }}>
          <button
            type="button"
            className="btn-secondary"
            onClick={clearFilters}
            disabled={!hasActiveFilters}
            style={{
              fontSize: "13.5px",
              fontWeight: "600",
              opacity: hasActiveFilters ? 1 : 0.5,
              cursor: hasActiveFilters ? "pointer" : "not-allowed",
              padding: "9px 15px",
            }}
            title={hasActiveFilters ? "Reset all search and filter criteria" : "No active filters to clear"}
          >
            Clear Filters
          </button>
          {onNavigateToCreate && (
            <button
              type="button"
              className="btn-primary"
              onClick={onNavigateToCreate}
              style={{ fontSize: "14px", fontWeight: "600", padding: "9px 18px" }}
            >
              ➕ Create Ticket
            </button>
          )}
        </div>
      </div>

      {/* Identity Required Callout */}
      {!selectedRequester && (
        <div style={{ padding: "16px", backgroundColor: "#FEF3C7", border: "1px solid #FDE68A", borderRadius: "8px", marginBottom: "20px" }}>
          ⚠️ <strong>Identity Context Required:</strong> Please select a Development Requester identity to view tickets.
          <button type="button" className="btn-secondary" style={{ marginLeft: "12px" }} onClick={openSelector}>
            Select Requester
          </button>
        </div>
      )}

      {/* Filter and Search Bar */}
      {selectedRequester && (
        <div
          style={{
            backgroundColor: "#F8FAFC",
            border: "1px solid #E2E8F0",
            borderRadius: "10px",
            padding: "18px 20px",
            marginBottom: "22px",
            boxShadow: "0 1px 3px rgba(0, 0, 0, 0.03)",
          }}
        >
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "12px", flexWrap: "wrap", gap: "8px" }}>
            <span style={{ fontSize: "12px", fontWeight: "800", color: "var(--color-primary)", textTransform: "uppercase", letterSpacing: "0.8px" }}>
              Filter & Search Tickets
            </span>
            {hasActiveFilters && (
              <span style={{ fontSize: "12px", color: "var(--color-secondary)", fontWeight: "700", backgroundColor: "var(--color-pale-green)", padding: "3px 10px", borderRadius: "12px", border: "1px solid rgba(0,107,60,0.15)" }}>
                Active Filters Applied
              </span>
            )}
          </div>

          <div className="filters-grid">
            {/* Search Input */}
            <div>
              <label
                htmlFor="ticket-search"
                className="filter-label"
              >
                Search
              </label>
              <input
                id="ticket-search"
                type="text"
                className="form-input"
                placeholder="Search by summary or ticket #..."
                aria-label="Search tickets"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
            </div>

            {/* Category Dropdown */}
            <div>
              <label
                htmlFor="filter-category"
                className="filter-label"
              >
                Categories
              </label>
              <select
                id="filter-category"
                className="form-select"
                aria-label="Filter by category"
                value={categoryId}
                onChange={handleCategoryChange}
              >
                <option value="">All Categories</option>
                {categories.map((cat) => (
                  <option key={cat.id} value={cat.id}>
                    {cat.name}
                  </option>
                ))}
              </select>
            </div>

            {/* Priority Dropdown */}
            <div>
              <label
                htmlFor="filter-priority"
                className="filter-label"
              >
                Priority
              </label>
              <select
                id="filter-priority"
                className="form-select"
                aria-label="Filter by priority"
                value={priority}
                onChange={handlePriorityChange}
              >
                <option value="">All Priorities</option>
                <option value="LOW">Low</option>
                <option value="MEDIUM">Medium</option>
                <option value="HIGH">High</option>
                <option value="URGENT">Urgent</option>
              </select>
            </div>

            {/* Status Dropdown */}
            <div>
              <label
                htmlFor="filter-status"
                className="filter-label"
              >
                Status
              </label>
              <select
                id="filter-status"
                className="form-select"
                aria-label="Filter by status"
                value={status}
                onChange={handleStatusChange}
              >
                <option value="">All Statuses</option>
                <option value="NEW">New</option>
                <option value="IN_PROGRESS">In Progress</option>
                <option value="RESOLVED">Resolved</option>
                <option value="CLOSED">Closed</option>
              </select>
            </div>

            {/* Sort Dropdown */}
            <div>
              <label
                htmlFor="filter-sort"
                className="filter-label"
              >
                Sort By
              </label>
              <select
                id="filter-sort"
                className="form-select"
                aria-label="Sort tickets"
                value={sort}
                onChange={handleSortChange}
              >
                <option value="createdAt_desc">Newest First</option>
                <option value="createdAt_asc">Oldest First</option>
                <option value="ticketNumber_asc">Ticket Number (Asc)</option>
                <option value="ticketNumber_desc">Ticket Number (Desc)</option>
              </select>
            </div>
          </div>
        </div>
      )}

      {/* Error Callout */}
      {error && (
        <div style={{ padding: "12px 16px", backgroundColor: "#FEE2E2", border: "1px solid #FCA5A5", borderRadius: "8px", marginBottom: "20px", color: "#991B1B" }}>
          ⚠️ <strong>Error loading tickets:</strong> {error}
          <button
            type="button"
            className="btn-secondary"
            style={{ marginLeft: "12px", fontSize: "12px", padding: "4px 8px" }}
            onClick={loadTickets}
          >
            Retry
          </button>
        </div>
      )}

      {/* Loading State */}
      {loading && (
        <div data-testid="loading-state" style={{ padding: "40px 0", textAlign: "center", color: "var(--color-text-secondary)" }}>
          <span style={{ fontSize: "20px", display: "block", marginBottom: "8px" }}>⏳</span>
          Loading tickets...
        </div>
      )}

      {/* Content states when not loading and no error */}
      {!loading && !error && selectedRequester && (
        <>
          {/* True Empty State: 0 tickets owned by requester */}
          {tickets.length === 0 && !hasActiveFilters && (
            <div
              data-testid="empty-ticket-state"
              style={{
                padding: "48px 24px",
                textAlign: "center",
                backgroundColor: "var(--color-pale-green)",
                borderRadius: "12px",
                border: "1px dashed var(--color-secondary)",
                margin: "20px 0",
              }}
            >
              <div style={{ fontSize: "36px", marginBottom: "12px" }}>🎫</div>
              <h2 style={{ fontSize: "18px", color: "var(--color-primary)", marginBottom: "6px" }}>
                No Tickets Found
              </h2>
              <p style={{ color: "var(--color-text-secondary)", marginBottom: "20px", maxWidth: "400px", margin: "0 auto 20px auto" }}>
                You haven't submitted any support requests yet. If you are experiencing technical difficulties, submit a ticket to get assistance.
              </p>
              {onNavigateToCreate && (
                <button type="button" className="btn-primary" onClick={onNavigateToCreate}>
                  ➕ Create First Ticket
                </button>
              )}
            </div>
          )}

          {/* Filtered No-Results State: active filters matched 0 tickets */}
          {tickets.length === 0 && hasActiveFilters && (
            <div
              data-testid="no-results-state"
              style={{
                padding: "40px 24px",
                textAlign: "center",
                backgroundColor: "#F8FAFC",
                borderRadius: "8px",
                border: "1px solid var(--color-border)",
                margin: "20px 0",
              }}
            >
              <div style={{ fontSize: "32px", marginBottom: "8px" }}>🔍</div>
              <h2 style={{ fontSize: "16px", color: "var(--color-text-primary)", marginBottom: "4px" }}>
                No Matching Tickets Found
              </h2>
              <p style={{ color: "var(--color-text-secondary)", fontSize: "14px", marginBottom: "16px" }}>
                No tickets match your search or active filter criteria. Try adjusting keywords or clearing filters.
              </p>
              <button type="button" className="btn-secondary" onClick={clearFilters}>
                Clear All Filters
              </button>
            </div>
          )}

          {/* Populated Tickets List */}
          {tickets.length > 0 && (
            <>
              {/* Desktop Table View */}
              <div className="tickets-table-container">
                <table className="tickets-table">
                  <thead>
                    <tr>
                      <th>Ticket Number</th>
                      <th>Date Created</th>
                      <th>Summary</th>
                      <th>Category</th>
                      <th>Related System</th>
                      <th>Priority</th>
                      <th>Status</th>
                      <th>Attachments</th>
                      <th>Last Updated</th>
                    </tr>
                  </thead>
                  <tbody>
                    {tickets.map((t) => (
                      <tr key={t.id}>
                        <td>
                          <strong style={{ color: "var(--color-primary)" }}>{t.ticketNumber}</strong>
                        </td>
                        <td>{formatDate(t.createdAt)}</td>
                        <td>
                          <div style={{ maxWidth: "260px", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                            {t.summary}
                          </div>
                        </td>
                        <td>{t.category?.name || "—"}</td>
                        <td>{t.relatedSystem?.name || "—"}</td>
                        <td>{renderPriorityBadge(t.requestedPriority)}</td>
                        <td>{renderStatusBadge(t.status)}</td>
                        <td>
                          {t.attachmentCount && t.attachmentCount > 0 ? (
                            <span style={{ fontSize: "12px", color: "var(--color-primary)", fontWeight: "500" }}>
                              📎 {t.attachmentCount}
                            </span>
                          ) : (
                            <span style={{ color: "var(--color-text-secondary)" }}>0</span>
                          )}
                        </td>
                        <td>{formatDate(t.updatedAt)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {/* Mobile Card View (< 768px) */}
              <div className="tickets-mobile-list">
                {tickets.map((t) => (
                  <div key={t.id} className="ticket-card">
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                      <strong style={{ color: "var(--color-primary)", fontSize: "14px" }}>
                        {t.ticketNumber}
                      </strong>
                      {renderStatusBadge(t.status)}
                    </div>
                    <div style={{ fontSize: "14px", fontWeight: "500", color: "var(--color-text-primary)" }}>
                      {t.summary}
                    </div>
                    <div style={{ display: "flex", flexWrap: "wrap", gap: "8px", fontSize: "12px", color: "var(--color-text-secondary)" }}>
                      <span>📂 {t.category?.name}</span>
                      <span>💻 {t.relatedSystem?.name}</span>
                      {renderPriorityBadge(t.requestedPriority)}
                      {t.attachmentCount && t.attachmentCount > 0 ? <span>📎 {t.attachmentCount}</span> : null}
                    </div>
                    <div style={{ fontSize: "11px", color: "var(--color-text-secondary)", marginTop: "4px" }}>
                      Created: {formatDate(t.createdAt)} | Updated: {formatDate(t.updatedAt)}
                    </div>
                  </div>
                ))}
              </div>

              {/* Pagination Bar */}
              {pagination && (
                <div
                  style={{
                    display: "flex",
                    justifyContent: "space-between",
                    alignItems: "center",
                    marginTop: "20px",
                    flexWrap: "wrap",
                    gap: "12px",
                    fontSize: "13px",
                    color: "var(--color-text-secondary)",
                  }}
                >
                  <div>
                    Showing{" "}
                    <strong>{(pagination.page - 1) * pagination.limit + 1}</strong> to{" "}
                    <strong>{Math.min(pagination.page * pagination.limit, pagination.totalItems)}</strong> of{" "}
                    <strong>{pagination.totalItems}</strong> tickets
                  </div>

                  <div style={{ display: "flex", gap: "6px", alignItems: "center" }}>
                    <button
                      type="button"
                      className="btn-secondary"
                      aria-label="Previous page"
                      style={{ padding: "6px 12px", minHeight: "32px", fontSize: "13px" }}
                      disabled={pagination.page <= 1}
                      onClick={() => setPage((p) => Math.max(1, p - 1))}
                    >
                      ◀ Previous
                    </button>

                    {Array.from({ length: pagination.totalPages }, (_, i) => i + 1).map((pNum) => (
                      <button
                        key={pNum}
                        type="button"
                        style={{
                          minWidth: "32px",
                          height: "32px",
                          padding: "0 6px",
                          borderRadius: "6px",
                          border: pNum === pagination.page ? "1px solid var(--color-primary)" : "1px solid var(--color-border)",
                          backgroundColor: pNum === pagination.page ? "var(--color-primary)" : "white",
                          color: pNum === pagination.page ? "white" : "var(--color-text-primary)",
                          fontWeight: pNum === pagination.page ? "bold" : "normal",
                          cursor: "pointer",
                        }}
                        onClick={() => setPage(pNum)}
                      >
                        {pNum}
                      </button>
                    ))}

                    <button
                      type="button"
                      className="btn-secondary"
                      aria-label="Next page"
                      style={{ padding: "6px 12px", minHeight: "32px", fontSize: "13px" }}
                      disabled={pagination.page >= pagination.totalPages}
                      onClick={() => setPage((p) => Math.min(pagination.totalPages, p + 1))}
                    >
                      Next ▶
                    </button>
                  </div>
                </div>
              )}
            </>
          )}
        </>
      )}
    </div>
  );
};
