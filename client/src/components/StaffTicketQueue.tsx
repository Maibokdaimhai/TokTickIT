import React, { useState, useEffect } from "react";
import { fetchCategories, fetchEligibleOwners, fetchStaffTickets } from "../api.js";
import {
  Category,
  Priority,
  TicketStatus,
  StaffTicketRow,
  EligibleOwner,
  PaginationInfo,
  FetchStaffTicketsParams,
  StaffSortOption,
} from "../types.js";

interface StaffTicketQueueProps {
  initialParams?: FetchStaffTicketsParams;
  onParamsChange?: (params: FetchStaffTicketsParams) => void;
  onOpenTicket: (ticketId: number) => void;
}

export const StaffTicketQueue: React.FC<StaffTicketQueueProps> = ({
  initialParams,
  onParamsChange,
  onOpenTicket,
}) => {
  // Reference data
  const [categories, setCategories] = useState<Category[]>([]);
  const [eligibleOwners, setEligibleOwners] = useState<EligibleOwner[]>([]);
  const [refDataError, setRefDataError] = useState<string | null>(null);

  // Query and pagination state
  const [search, setSearch] = useState<string>(initialParams?.search ?? "");
  const [debouncedSearch, setDebouncedSearch] = useState<string>(initialParams?.search ?? "");
  const [categoryId, setCategoryId] = useState<number | "">(initialParams?.category ?? "");
  const [requestedPriority, setRequestedPriority] = useState<Priority | "">(initialParams?.requestedPriority ?? "");
  const [itPriority, setItPriority] = useState<Priority | "">(initialParams?.itPriority ?? "");
  const [status, setStatus] = useState<TicketStatus | "">(initialParams?.status ?? "");
  const [owner, setOwner] = useState<string>(
    initialParams?.owner !== undefined ? String(initialParams.owner) : ""
  );
  const [sort, setSort] = useState<StaffSortOption>(initialParams?.sort ?? "updatedAt_desc");
  const [page, setPage] = useState<number>(initialParams?.page ?? 1);
  const [limit, setLimit] = useState<number>(initialParams?.limit ?? 10);

  // Tickets & fetch status
  const [tickets, setTickets] = useState<StaffTicketRow[]>([]);
  const [pagination, setPagination] = useState<PaginationInfo | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [isForbidden, setIsForbidden] = useState<boolean>(false);
  const [retryKey, setRetryKey] = useState<number>(0);

  const prevSearchRef = React.useRef<string>(initialParams?.search ?? "");

  // Load categories and eligible owners on mount
  const loadReferenceData = () => {
    setRefDataError(null);
    Promise.all([
      fetchCategories().then(setCategories),
      fetchEligibleOwners().then((res) => setEligibleOwners(res.owners)),
    ]).catch(() => {
      setRefDataError("Unable to load filter options. Some filter dropdowns may be incomplete.");
    });
  };

  useEffect(() => {
    loadReferenceData();
  }, []);

  // Debounce search input (only schedule debounce and reset page when search actually changes, safe in StrictMode)
  useEffect(() => {
    if (search === prevSearchRef.current) {
      return;
    }
    const handler = setTimeout(() => {
      prevSearchRef.current = search;
      setDebouncedSearch(search);
      setPage(1);
    }, 300);
    return () => clearTimeout(handler);
  }, [search]);

  // Check if any non-default filter is active
  const hasActiveFilters = Boolean(
    debouncedSearch.trim() ||
      categoryId !== "" ||
      requestedPriority !== "" ||
      itPriority !== "" ||
      status !== "" ||
      owner !== "" ||
      sort !== "updatedAt_desc"
  );

  const clearFilters = () => {
    setSearch("");
    setDebouncedSearch("");
    prevSearchRef.current = "";
    setCategoryId("");
    setRequestedPriority("");
    setItPriority("");
    setStatus("");
    setOwner("");
    setSort("updatedAt_desc");
    setPage(1);
  };

  // Fetch tickets
  useEffect(() => {
    let isCancelled = false;
    const controller = new AbortController();
    setLoading(true);
    setError(null);
    setIsForbidden(false);

    const currentParams: FetchStaffTicketsParams = {
      search: debouncedSearch.trim() || undefined,
      category: categoryId === "" ? undefined : Number(categoryId),
      requestedPriority: requestedPriority === "" ? undefined : requestedPriority,
      itPriority: itPriority === "" ? undefined : itPriority,
      status: status === "" ? undefined : status,
      owner: owner === "" ? undefined : owner,
      sort,
      page,
      limit,
      signal: controller.signal,
    };

    fetchStaffTickets(currentParams)
      .then((res) => {
        if (isCancelled || controller.signal.aborted) return;
        setTickets(res.tickets);
        setPagination(res.pagination);
        setLoading(false);
        onParamsChange?.({
          search: debouncedSearch,
          category: categoryId === "" ? undefined : Number(categoryId),
          requestedPriority: requestedPriority === "" ? undefined : requestedPriority,
          itPriority: itPriority === "" ? undefined : itPriority,
          status: status === "" ? undefined : status,
          owner: owner === "" ? undefined : owner,
          sort,
          page,
          limit,
        });
      })
      .catch((err: any) => {
        if (isCancelled || controller.signal.aborted || err?.name === "AbortError") return;
        if (err?.status === 403) {
          setIsForbidden(true);
        } else {
          setError(err?.message || "Failed to load staff ticket queue.");
        }
        setLoading(false);
      });

    return () => {
      isCancelled = true;
      controller.abort();
    };
  }, [debouncedSearch, categoryId, requestedPriority, itPriority, status, owner, sort, page, limit, retryKey]);

  // Badge renderers
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
      OPEN: "badge-status-open",
      IN_PROGRESS: "badge-status-in_progress",
      WAITING_FOR_REQUESTER: "badge-status-waiting_for_requester",
      RESOLVED: "badge-status-resolved",
      CLOSED: "badge-status-closed",
      REOPENED: "badge-status-reopened",
      CANCELLED: "badge-status-cancelled",
    };
    const labelMap: Record<TicketStatus, string> = {
      NEW: "New",
      OPEN: "Open",
      IN_PROGRESS: "In Progress",
      WAITING_FOR_REQUESTER: "Waiting for Requester",
      RESOLVED: "Resolved",
      CLOSED: "Closed",
      REOPENED: "Reopened",
      CANCELLED: "Cancelled",
    };
    return <span className={`badge ${classMap[s] || "badge-status-new"}`}>{labelMap[s] || s}</span>;
  };

  const formatDate = (isoStr: string) => {
    try {
      const d = new Date(isoStr);
      return d.toLocaleDateString("en-US", {
        month: "short",
        day: "numeric",
        year: "numeric",
        hour: "2-digit",
        minute: "2-digit",
      });
    } catch {
      return isoStr;
    }
  };

  return (
    <div
      style={{
        backgroundColor: "white",
        padding: "24px",
        borderRadius: "12px",
        border: "1px solid var(--color-border)",
        boxShadow: "0 2px 8px rgba(0,0,0,0.03)",
      }}
    >
      {/* Header section */}
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "flex-start",
          marginBottom: "20px",
          flexWrap: "wrap",
          gap: "14px",
        }}
      >
        <div>
          <div style={{ display: "flex", alignItems: "center", gap: "10px", marginBottom: "6px" }}>
            <h1 style={{ fontSize: "22px", fontWeight: "800", color: "var(--color-primary)", margin: 0 }}>
              🎫 IT Staff Ticket Queue
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
            Manage and respond to university IT service requests and incident tickets.
          </p>
        </div>

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
      </div>

      {/* Reference data warning banner */}
      {refDataError && (
        <div
          data-testid="queue-ref-warning"
          role="status"
          style={{
            padding: "10px 14px",
            backgroundColor: "#FFFBEB",
            border: "1px solid #FCD34D",
            borderRadius: "8px",
            marginBottom: "16px",
            fontSize: "13px",
            color: "#92400E",
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
          }}
        >
          <span>⚠️ {refDataError}</span>
          <button
            type="button"
            className="btn-secondary"
            style={{ fontSize: "12px", padding: "4px 10px" }}
            onClick={loadReferenceData}
          >
            Retry Options
          </button>
        </div>
      )}

      {/* Filter and Search Bar */}
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
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            marginBottom: "12px",
            flexWrap: "wrap",
            gap: "8px",
          }}
        >
          <span
            style={{
              fontSize: "12px",
              fontWeight: "800",
              color: "var(--color-primary)",
              textTransform: "uppercase",
              letterSpacing: "0.8px",
            }}
          >
            Filter & Search Queue
          </span>
          {hasActiveFilters && (
            <span
              style={{
                fontSize: "12px",
                color: "var(--color-secondary)",
                fontWeight: "700",
                backgroundColor: "var(--color-pale-green)",
                padding: "3px 10px",
                borderRadius: "12px",
                border: "1px solid rgba(0,107,60,0.15)",
              }}
            >
              Active Filters Applied
            </span>
          )}
        </div>

        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit, minmax(170px, 1fr))",
            gap: "12px",
            alignItems: "flex-end",
          }}
        >
          {/* Search Input */}
          <div>
            <label htmlFor="staff-ticket-search" className="filter-label">
              Search
            </label>
            <input
              id="staff-ticket-search"
              type="text"
              className="form-input"
              placeholder="Summary or ticket #..."
              aria-label="Search tickets"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>

          {/* Category Dropdown */}
          <div>
            <label htmlFor="staff-filter-category" className="filter-label">
              Category
            </label>
            <select
              id="staff-filter-category"
              className="form-select"
              aria-label="Filter by category"
              value={categoryId}
              onChange={(e) => {
                setCategoryId(e.target.value ? Number(e.target.value) : "");
                setPage(1);
              }}
            >
              <option value="">All Categories</option>
              {categories.map((cat) => (
                <option key={cat.id} value={cat.id}>
                  {cat.name}
                </option>
              ))}
            </select>
          </div>

          {/* Status Dropdown */}
          <div>
            <label htmlFor="staff-filter-status" className="filter-label">
              Status
            </label>
            <select
              id="staff-filter-status"
              className="form-select"
              aria-label="Filter by status"
              value={status}
              onChange={(e) => {
                setStatus(e.target.value as TicketStatus | "");
                setPage(1);
              }}
            >
              <option value="">All Statuses</option>
              <option value="NEW">New</option>
              <option value="OPEN">Open</option>
              <option value="IN_PROGRESS">In Progress</option>
              <option value="WAITING_FOR_REQUESTER">Waiting for Requester</option>
              <option value="RESOLVED">Resolved</option>
              <option value="CLOSED">Closed</option>
              <option value="REOPENED">Reopened</option>
              <option value="CANCELLED">Cancelled</option>
            </select>
          </div>

          {/* Requested Priority Dropdown */}
          <div>
            <label htmlFor="staff-filter-req-priority" className="filter-label">
              Req. Priority
            </label>
            <select
              id="staff-filter-req-priority"
              className="form-select"
              aria-label="Filter by requested priority"
              value={requestedPriority}
              onChange={(e) => {
                setRequestedPriority(e.target.value as Priority | "");
                setPage(1);
              }}
            >
              <option value="">All Req. Priorities</option>
              <option value="LOW">Low</option>
              <option value="MEDIUM">Medium</option>
              <option value="HIGH">High</option>
              <option value="URGENT">Urgent</option>
            </select>
          </div>

          {/* IT Priority Dropdown */}
          <div>
            <label htmlFor="staff-filter-it-priority" className="filter-label">
              IT Priority
            </label>
            <select
              id="staff-filter-it-priority"
              className="form-select"
              aria-label="Filter by IT priority"
              value={itPriority}
              onChange={(e) => {
                setItPriority(e.target.value as Priority | "");
                setPage(1);
              }}
            >
              <option value="">All IT Priorities</option>
              <option value="LOW">Low</option>
              <option value="MEDIUM">Medium</option>
              <option value="HIGH">High</option>
              <option value="URGENT">Urgent</option>
            </select>
          </div>

          {/* Owner Dropdown */}
          <div>
            <label htmlFor="staff-filter-owner" className="filter-label">
              Owner
            </label>
            <select
              id="staff-filter-owner"
              className="form-select"
              aria-label="Filter by owner"
              value={owner}
              onChange={(e) => {
                setOwner(e.target.value);
                setPage(1);
              }}
            >
              <option value="">All Owners</option>
              <option value="unassigned">Unassigned</option>
              <option value="me">Assigned to Me</option>
              {eligibleOwners.map((own) => (
                <option key={own.id} value={own.id}>
                  {own.name} ({own.role === "ADMINISTRATOR" ? "Admin" : "Staff"})
                </option>
              ))}
            </select>
          </div>

          {/* Sort Selector */}
          <div>
            <label htmlFor="staff-filter-sort" className="filter-label">
              Sort By
            </label>
            <select
              id="staff-filter-sort"
              className="form-select"
              aria-label="Sort queue"
              value={sort}
              onChange={(e) => {
                setSort(e.target.value as StaffSortOption);
                setPage(1);
              }}
            >
              <option value="updatedAt_desc">Last Updated (Newest)</option>
              <option value="createdAt_desc">Date Created (Newest)</option>
              <option value="createdAt_asc">Date Created (Oldest)</option>
              <option value="ticketNumber_asc">Ticket # (Ascending)</option>
              <option value="ticketNumber_desc">Ticket # (Descending)</option>
              <option value="itPriority_desc">IT Priority (Urgent First)</option>
            </select>
          </div>

          {/* Page Size Selector */}
          <div>
            <label htmlFor="staff-page-size" className="filter-label">
              Per Page
            </label>
            <select
              id="staff-page-size"
              className="form-select"
              aria-label="Page size"
              value={limit}
              onChange={(e) => {
                setLimit(Number(e.target.value));
                setPage(1);
              }}
            >
              <option value={10}>10</option>
              <option value={20}>20</option>
              <option value={50}>50</option>
            </select>
          </div>
        </div>
      </div>

      {/* Forbidden State */}
      {isForbidden && (
        <div
          data-testid="queue-forbidden"
          role="alert"
          style={{
            padding: "16px 20px",
            backgroundColor: "#FEE2E2",
            border: "1px solid #FCA5A5",
            borderRadius: "8px",
            marginBottom: "20px",
            color: "#991B1B",
          }}
        >
          🔒 <strong>Access Forbidden:</strong> You do not have permission to access the IT Staff queue. Contact your administrator if you believe this is an error.
        </div>
      )}

      {/* Error Callout (for non-403 failures) */}
      {!isForbidden && error && (
        <div
          data-testid="queue-error"
          role="alert"
          style={{
            padding: "12px 16px",
            backgroundColor: "#FEE2E2",
            border: "1px solid #FCA5A5",
            borderRadius: "8px",
            marginBottom: "20px",
            color: "#991B1B",
          }}
        >
          ⚠️ <strong>Error loading queue:</strong> {error}
          <button
            type="button"
            className="btn-secondary"
            style={{ marginLeft: "12px", fontSize: "12px", padding: "4px 8px" }}
            onClick={() => setRetryKey((k) => k + 1)}
          >
            Retry
          </button>
        </div>
      )}

      {/* Loading State */}
      {loading && (
        <div data-testid="queue-loading" style={{ padding: "40px 0", textAlign: "center", color: "var(--color-text-secondary)" }}>
          <span style={{ fontSize: "20px", display: "block", marginBottom: "8px" }}>⏳</span>
          Loading queue tickets...
        </div>
      )}

      {/* Content states when not loading and no error */}
      {!loading && !error && !isForbidden && (
        <>
          {/* True Empty State */}
          {tickets.length === 0 && !hasActiveFilters && (
            <div
              data-testid="queue-empty"
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
                No Tickets in Queue
              </h2>
              <p style={{ color: "var(--color-text-secondary)", maxWidth: "400px", margin: "0 auto" }}>
                The IT staff queue is currently clear. New support tickets will appear here as requesters submit them.
              </p>
            </div>
          )}

          {/* Filtered No-Results State */}
          {tickets.length === 0 && hasActiveFilters && (
            <div
              data-testid="queue-no-results"
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
                No queue tickets match your active filter or search criteria. Try broadening your keywords or clearing filters.
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
                <table className="tickets-table" aria-label="IT Staff Ticket Queue">
                  <thead>
                    <tr>
                      <th>Ticket Number</th>
                      <th>Updated</th>
                      <th>Summary</th>
                      <th>Category</th>
                      <th>Requested Priority</th>
                      <th>IT Priority</th>
                      <th>Status</th>
                      <th>Owner</th>
                      <th style={{ textAlign: "center" }}>Action</th>
                    </tr>
                  </thead>
                  <tbody>
                    {tickets.map((t) => (
                      <tr key={t.id} data-testid={`queue-row-${t.id}`}>
                        <td>
                          <strong style={{ color: "var(--color-primary)" }}>{t.ticketNumber}</strong>
                        </td>
                        <td style={{ fontSize: "12px", whiteSpace: "nowrap" }}>{formatDate(t.updatedAt)}</td>
                        <td>
                          <div
                            style={{
                              maxWidth: "240px",
                              overflow: "hidden",
                              textOverflow: "ellipsis",
                              whiteSpace: "nowrap",
                            }}
                            title={t.summary}
                          >
                            {t.summary}
                          </div>
                        </td>
                        <td>{t.category?.name || "—"}</td>
                        <td>{renderPriorityBadge(t.requestedPriority)}</td>
                        <td>{renderPriorityBadge(t.itPriority)}</td>
                        <td>{renderStatusBadge(t.status)}</td>
                        <td>
                          {t.owner ? (
                            <span style={{ fontWeight: "600" }}>{t.owner.name}</span>
                          ) : (
                            <span style={{ color: "var(--color-text-secondary)", fontStyle: "italic" }}>
                              Unassigned
                            </span>
                          )}
                        </td>
                        <td style={{ textAlign: "center", whiteSpace: "nowrap" }}>
                          <button
                            type="button"
                            className="btn-secondary"
                            style={{ padding: "5px 12px", minHeight: "32px", fontSize: "12.5px" }}
                            onClick={() => onOpenTicket(t.id)}
                            aria-label={`Open ticket ${t.ticketNumber}`}
                          >
                            Open
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {/* Mobile Card View (< 768px) */}
              <div className="tickets-mobile-list" data-testid="queue-mobile-list">
                {tickets.map((t) => (
                  <div key={t.id} className="ticket-card" data-testid={`queue-card-${t.id}`}>
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                      <strong style={{ color: "var(--color-primary)", fontSize: "14.5px" }}>
                        {t.ticketNumber}
                      </strong>
                      {renderStatusBadge(t.status)}
                    </div>

                    <div style={{ fontSize: "14px", fontWeight: "600", color: "var(--color-text-primary)" }}>
                      {t.summary}
                    </div>

                    <div style={{ display: "flex", flexWrap: "wrap", gap: "8px", fontSize: "12px" }}>
                      <span>📂 {t.category?.name || "—"}</span>
                      <span>💻 {t.relatedSystem?.name || "—"}</span>
                      {t.attachmentCount > 0 && <span>📎 {t.attachmentCount}</span>}
                      {t.publicCommentCount > 0 && <span>💬 {t.publicCommentCount}</span>}
                    </div>

                    <div style={{ display: "flex", flexWrap: "wrap", gap: "6px", alignItems: "center", fontSize: "12px" }}>
                      <span style={{ color: "var(--color-text-secondary)" }}>Req:</span>
                      {renderPriorityBadge(t.requestedPriority)}
                      <span style={{ color: "var(--color-text-secondary)", marginLeft: "4px" }}>IT:</span>
                      {renderPriorityBadge(t.itPriority)}
                    </div>

                    <div style={{ fontSize: "12px", color: "var(--color-text-secondary)" }}>
                      Owner:{" "}
                      <strong>
                        {t.owner ? t.owner.name : "Unassigned"}
                      </strong>
                    </div>

                    <div style={{ fontSize: "11px", color: "var(--color-text-secondary)" }}>
                      Updated: {formatDate(t.updatedAt)}
                    </div>

                    <button
                      type="button"
                      className="btn-primary"
                      style={{ width: "100%", marginTop: "6px" }}
                      onClick={() => onOpenTicket(t.id)}
                      aria-label={`Open ticket ${t.ticketNumber}`}
                    >
                      Open Ticket
                    </button>
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
                    <strong>{pagination.totalItems === 0 ? 0 : (pagination.page - 1) * pagination.limit + 1}</strong> to{" "}
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
                          border:
                            pNum === pagination.page
                              ? "1px solid var(--color-primary)"
                              : "1px solid var(--color-border)",
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
