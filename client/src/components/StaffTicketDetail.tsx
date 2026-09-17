import React, { useState, useEffect, useRef } from "react";
import {
  StaffTicketDetail as StaffTicketDetailType,
  EligibleOwner,
  Priority,
  TicketStatus,
  Entry,
} from "../types.js";
import {
  API_URL,
  fetchStaffTicketDetail,
  fetchEligibleOwners,
  claimTicket,
  updateTicketOwner,
  updateTicketItPriority,
  updateTicketStatus,
  addPublicComment,
  addInternalNote,
  getAttachmentDownloadUrl,
  downloadAttachmentByUrl,
} from "../api.js";

interface StaffTicketDetailProps {
  ticketId: number;
  onBack: () => void;
}

const STATUS_TRANSITIONS: Record<TicketStatus, TicketStatus[]> = {
  NEW: ["OPEN", "CANCELLED"],
  OPEN: ["IN_PROGRESS", "WAITING_FOR_REQUESTER", "RESOLVED", "CANCELLED"],
  IN_PROGRESS: ["WAITING_FOR_REQUESTER", "RESOLVED", "CANCELLED"],
  WAITING_FOR_REQUESTER: ["IN_PROGRESS", "RESOLVED", "CANCELLED"],
  RESOLVED: ["CLOSED", "REOPENED"],
  REOPENED: ["IN_PROGRESS", "WAITING_FOR_REQUESTER", "RESOLVED", "CANCELLED"],
  CLOSED: ["REOPENED"],
  CANCELLED: ["REOPENED"],
};

const CONFIRMATION_STATUSES: TicketStatus[] = [
  "RESOLVED",
  "CLOSED",
  "CANCELLED",
  "REOPENED",
];

const OWNER_REQUIRED_STATUSES: TicketStatus[] = [
  "IN_PROGRESS",
  "WAITING_FOR_REQUESTER",
  "RESOLVED",
];

export const StaffTicketDetail: React.FC<StaffTicketDetailProps> = ({
  ticketId,
  onBack,
}) => {
  // Ticket loading state
  const [ticket, setTicket] = useState<StaffTicketDetailType | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [statusCode, setStatusCode] = useState<number | null>(null);

  // Eligible owners state
  const [eligibleOwners, setEligibleOwners] = useState<EligibleOwner[]>([]);
  const [ownersLoading, setOwnersLoading] = useState<boolean>(true);
  const [ownersError, setOwnersError] = useState<string | null>(null);

  // Operations state
  const [selectedOwnerId, setSelectedOwnerId] = useState<string>("");
  const [isSavingOwner, setIsSavingOwner] = useState<boolean>(false);
  const [ownerError, setOwnerError] = useState<string | null>(null);
  const [isClaiming, setIsClaiming] = useState<boolean>(false);
  const [claimError, setClaimError] = useState<string | null>(null);

  const [selectedItPriority, setSelectedItPriority] = useState<Priority>("LOW");
  const [isSavingItPriority, setIsSavingItPriority] = useState<boolean>(false);
  const [itPriorityError, setItPriorityError] = useState<string | null>(null);

  const [selectedStatus, setSelectedStatus] = useState<TicketStatus | "">("");
  const [isSavingStatus, setIsSavingStatus] = useState<boolean>(false);
  const [statusError, setStatusError] = useState<string | null>(null);
  const [statusOwnerRequiredError, setStatusOwnerRequiredError] = useState<string | null>(null);

  // 409 conflict and refresh failure state
  const [conflictError, setConflictError] = useState<string | null>(null);
  const [refreshFailed, setRefreshFailed] = useState<boolean>(false);

  // Status confirmation modal state
  const [statusModalOpen, setStatusModalOpen] = useState<boolean>(false);
  const [targetStatus, setTargetStatus] = useState<TicketStatus | null>(null);
  const [isConfirmingStatus, setIsConfirmingStatus] = useState<boolean>(false);
  const statusTriggerRef = useRef<HTMLButtonElement | null>(null);
  const statusModalRef = useRef<HTMLDivElement | null>(null);

  // Public comments & Internal notes state
  const [publicComments, setPublicComments] = useState<Entry[]>([]);
  const [publicCommentDraft, setPublicCommentDraft] = useState<string>("");
  const [isSubmittingPublicComment, setIsSubmittingPublicComment] = useState<boolean>(false);
  const [publicCommentError, setPublicCommentError] = useState<string | null>(null);

  const [internalNotes, setInternalNotes] = useState<Entry[]>([]);
  const [internalNoteDraft, setInternalNoteDraft] = useState<string>("");
  const [isSubmittingInternalNote, setIsSubmittingInternalNote] = useState<boolean>(false);
  const [internalNoteError, setInternalNoteError] = useState<string | null>(null);

  // Attachment download state & error recovery
  const [downloadingAttachmentId, setDownloadingAttachmentId] = useState<number | null>(null);
  const [attachmentDownloadError, setAttachmentDownloadError] = useState<string | null>(null);

  const loadTicket = async () => {
    setLoading(true);
    setError(null);
    setStatusCode(null);
    setConflictError(null);
    try {
      const data = await fetchStaffTicketDetail(ticketId);
      setTicket(data);
      setSelectedOwnerId(data.owner?.id ? String(data.owner.id) : "");
      setSelectedItPriority(data.itPriority || "LOW");
      const legalNext = STATUS_TRANSITIONS[data.status] || [];
      setSelectedStatus(legalNext[0] || "");
      setPublicComments(data.publicComments ?? []);
      setInternalNotes(data.internalNotes ?? []);
      setRefreshFailed(false);
    } catch (err: any) {
      setError(err?.message || "Failed to load ticket details");
      if (err?.status) {
        setStatusCode(err.status);
      }
    } finally {
      setLoading(false);
    }
  };

  const loadOwners = async () => {
    setOwnersLoading(true);
    setOwnersError(null);
    try {
      const res = await fetchEligibleOwners();
      setEligibleOwners(res.owners);
    } catch (err: any) {
      setOwnersError(err?.message || "Failed to load eligible owners");
    } finally {
      setOwnersLoading(false);
    }
  };

  const reloadTicket = async () => {
    try {
      const data = await fetchStaffTicketDetail(ticketId);
      setTicket(data);
      setSelectedOwnerId(data.owner?.id ? String(data.owner.id) : "");
      setSelectedItPriority(data.itPriority || "LOW");
      const legalNext = STATUS_TRANSITIONS[data.status] || [];
      setSelectedStatus(legalNext[0] || "");
      setPublicComments(data.publicComments ?? []);
      setInternalNotes(data.internalNotes ?? []);
      setConflictError(null);
      setRefreshFailed(false);
      setStatusOwnerRequiredError(null);
      setStatusError(null);
      setOwnerError(null);
      setItPriorityError(null);
    } catch (err: any) {
      setRefreshFailed(true);
      throw err;
    }
  };

  useEffect(() => {
    loadTicket();
    loadOwners();
  }, [ticketId]);

  // Modal accessibility: ESC key & Tab trap
  useEffect(() => {
    if (!statusModalOpen) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        if (!isConfirmingStatus) {
          handleCloseStatusModal();
        }
      } else if (e.key === "Tab") {
        if (!statusModalRef.current) return;
        const focusables = statusModalRef.current.querySelectorAll<HTMLElement>(
          'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
        );
        if (focusables.length === 0) return;
        const first = focusables[0];
        const last = focusables[focusables.length - 1];
        if (e.shiftKey) {
          if (document.activeElement === first) {
            e.preventDefault();
            last.focus();
          }
        } else {
          if (document.activeElement === last) {
            e.preventDefault();
            first.focus();
          }
        }
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [statusModalOpen, isConfirmingStatus]);

  const formatDate = (dateStr?: string | null) => {
    if (!dateStr) return "N/A";
    try {
      return new Date(dateStr).toLocaleString("en-US", {
        month: "short",
        day: "numeric",
        year: "numeric",
        hour: "numeric",
        minute: "2-digit",
        hour12: true,
      });
    } catch {
      return dateStr;
    }
  };

  const formatFileSize = (bytes: number) => {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  };

  const renderStatusBadge = (status: TicketStatus) => {
    const colors: Record<TicketStatus, { bg: string; text: string }> = {
      NEW: { bg: "#E0F2FE", text: "#0369A1" },
      OPEN: { bg: "#CCFBF1", text: "#0F766E" },
      IN_PROGRESS: { bg: "#FEF3C7", text: "#B45309" },
      WAITING_FOR_REQUESTER: { bg: "#F3E8FF", text: "#7E22CE" },
      RESOLVED: { bg: "#DCFCE7", text: "#15803D" },
      CLOSED: { bg: "#F3F4F6", text: "#4B5563" },
      REOPENED: { bg: "#FFEDD5", text: "#C2410C" },
      CANCELLED: { bg: "#FEE2E2", text: "#B91C1C" },
    };
    const c = colors[status] || { bg: "#F3F4F6", text: "#4B5563" };
    return (
      <span
        data-testid="status-badge"
        style={{
          backgroundColor: c.bg,
          color: c.text,
          padding: "4px 10px",
          borderRadius: "16px",
          fontSize: "12px",
          fontWeight: 700,
          display: "inline-flex",
          alignItems: "center",
          gap: "4px",
        }}
      >
        ● {status}
      </span>
    );
  };

  const renderPriorityBadge = (priority?: Priority | null, testId = "priority-badge") => {
    const p = priority || "LOW";
    const colors: Record<Priority, { bg: string; text: string }> = {
      LOW: { bg: "#F3F4F6", text: "#4B5563" },
      MEDIUM: { bg: "#FEF3C7", text: "#B45309" },
      HIGH: { bg: "#FFEDD5", text: "#C2410C" },
      URGENT: { bg: "#FEE2E2", text: "#B91C1C" },
    };
    const c = colors[p] || colors.LOW;
    return (
      <span
        data-testid={testId}
        style={{
          backgroundColor: c.bg,
          color: c.text,
          padding: "4px 10px",
          borderRadius: "16px",
          fontSize: "12px",
          fontWeight: 700,
        }}
      >
        {p}
      </span>
    );
  };

  // Claim Handler
  const handleClaim = async () => {
    if (!ticket) return;
    setIsClaiming(true);
    setClaimError(null);
    setConflictError(null);
    try {
      const res = await claimTicket(ticketId, { expectedVersion: ticket.version ?? 0 });
      setTicket(res.ticket);
      setSelectedOwnerId(res.ticket.owner?.id ? String(res.ticket.owner.id) : "");
      const legalNext = STATUS_TRANSITIONS[res.ticket.status as TicketStatus] || [];
      setSelectedStatus(legalNext[0] || "");
    } catch (err: any) {
      if (err?.status === 409 || err?.code === "VERSION_CONFLICT" || err?.code === "STATUS_CONFLICT") {
        setConflictError(err.message || "Conflict: Ticket was modified by another user.");
      } else {
        setClaimError(err?.message || "Failed to claim ticket");
      }
    } finally {
      setIsClaiming(false);
    }
  };

  // Owner Reassignment Handler
  const handleSaveOwner = async () => {
    if (!ticket) return;
    setIsSavingOwner(true);
    setOwnerError(null);
    setConflictError(null);
    try {
      const targetOwnerId = selectedOwnerId ? Number(selectedOwnerId) : null;
      const res = await updateTicketOwner(ticketId, {
        ownerId: targetOwnerId,
        expectedVersion: ticket.version ?? 0,
      });
      setTicket(res.ticket);
      setSelectedOwnerId(res.ticket.owner?.id ? String(res.ticket.owner.id) : "");
    } catch (err: any) {
      if (err?.status === 409 || err?.code === "VERSION_CONFLICT" || err?.code === "STATUS_CONFLICT") {
        setConflictError(err.message || "Conflict: Ticket was modified by another user.");
      } else if (err?.status === 400) {
        setOwnerError(err?.message || "Selected owner is not eligible");
        // Automatically refresh eligible owners choices
        loadOwners();
      } else {
        setOwnerError(err?.message || "Failed to reassign owner");
      }
    } finally {
      setIsSavingOwner(false);
    }
  };

  // IT Priority Handler
  const handleSaveItPriority = async () => {
    if (!ticket) return;
    setIsSavingItPriority(true);
    setItPriorityError(null);
    setConflictError(null);
    try {
      const res = await updateTicketItPriority(ticketId, {
        itPriority: selectedItPriority,
        expectedVersion: ticket.version ?? 0,
      });
      setTicket(res.ticket);
      setSelectedItPriority(res.ticket.itPriority || "LOW");
    } catch (err: any) {
      if (err?.status === 409 || err?.code === "VERSION_CONFLICT" || err?.code === "STATUS_CONFLICT") {
        setConflictError(err.message || "Conflict: Ticket was modified by another user.");
      } else {
        setItPriorityError(err?.message || "Failed to update IT Priority");
      }
    } finally {
      setIsSavingItPriority(false);
    }
  };

  // Status Transition Trigger
  const handleStatusChangeClick = async () => {
    if (!ticket || !selectedStatus || selectedStatus === ticket.status) return;
    setStatusError(null);
    setStatusOwnerRequiredError(null);
    setConflictError(null);

    // Check owner requirement for IN_PROGRESS, WAITING_FOR_REQUESTER, RESOLVED
    if (OWNER_REQUIRED_STATUSES.includes(selectedStatus as TicketStatus) && !ticket.owner) {
      setStatusOwnerRequiredError("An eligible owner must be assigned before moving to this status.");
      return;
    }

    // Check if confirmation modal is required
    if (CONFIRMATION_STATUSES.includes(selectedStatus as TicketStatus)) {
      setTargetStatus(selectedStatus as TicketStatus);
      setStatusModalOpen(true);
      return;
    }

    // Unconfirmed transition (e.g. NEW -> OPEN)
    setIsSavingStatus(true);
    try {
      const res = await updateTicketStatus(ticketId, {
        status: selectedStatus as TicketStatus,
        expectedStatus: ticket.status,
        expectedVersion: ticket.version ?? 0,
      });
      setTicket(res.ticket);
      const legalNext = STATUS_TRANSITIONS[res.ticket.status as TicketStatus] || [];
      setSelectedStatus(legalNext[0] || "");
    } catch (err: any) {
      if (err?.status === 409 || err?.code === "VERSION_CONFLICT" || err?.code === "STATUS_CONFLICT") {
        setConflictError(err.message || "Conflict: Ticket was modified by another user.");
      } else {
        setStatusError(err?.message || "Failed to update status");
      }
    } finally {
      setIsSavingStatus(false);
    }
  };

  const handleCloseStatusModal = () => {
    if (isConfirmingStatus) return;
    setStatusModalOpen(false);
    setTargetStatus(null);
    setTimeout(() => {
      statusTriggerRef.current?.focus();
    }, 0);
  };

  const handleConfirmStatusModal = async () => {
    if (!ticket || !targetStatus) return;
    setIsConfirmingStatus(true);
    setStatusError(null);
    try {
      const res = await updateTicketStatus(ticketId, {
        status: targetStatus,
        expectedStatus: ticket.status,
        expectedVersion: ticket.version ?? 0,
        confirmed: true,
      });
      setTicket(res.ticket);
      const legalNext = STATUS_TRANSITIONS[res.ticket.status as TicketStatus] || [];
      setSelectedStatus(legalNext[0] || "");
      setStatusModalOpen(false);
      setTargetStatus(null);
      setTimeout(() => {
        statusTriggerRef.current?.focus();
      }, 0);
    } catch (err: any) {
      if (err?.status === 409 || err?.code === "VERSION_CONFLICT" || err?.code === "STATUS_CONFLICT") {
        setConflictError(err.message || "Conflict: Ticket was modified by another user.");
        setStatusModalOpen(false);
        setTargetStatus(null);
      } else {
        setStatusError(err?.message || "Failed to confirm status update");
      }
    } finally {
      setIsConfirmingStatus(false);
    }
  };

  // Public Comment Submit
  const handleSubmitPublicComment = async (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = publicCommentDraft.trim();
    const codePoints = Array.from(trimmed).length;
    if (!trimmed || codePoints > 2000) {
      setPublicCommentError("Comment must be between 1 and 2000 characters.");
      return;
    }
    setIsSubmittingPublicComment(true);
    setPublicCommentError(null);
    try {
      const res = await addPublicComment(ticketId, trimmed);
      setPublicComments((prev) => [...prev, res.comment]);
      setPublicCommentDraft("");
      try {
        await reloadTicket();
      } catch (reloadErr) {
        // Refresh failed rule: comment was already saved, do NOT retry comment creation
      }
    } catch (err: any) {
      setPublicCommentError(err?.message || "Failed to submit public comment");
    } finally {
      setIsSubmittingPublicComment(false);
    }
  };

  // Internal Note Submit
  const handleSubmitInternalNote = async (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = internalNoteDraft.trim();
    const codePoints = Array.from(trimmed).length;
    if (!trimmed || codePoints > 2000) {
      setInternalNoteError("Internal note must be between 1 and 2000 characters.");
      return;
    }
    setIsSubmittingInternalNote(true);
    setInternalNoteError(null);
    try {
      const res = await addInternalNote(ticketId, trimmed);
      setInternalNotes((prev) => [...prev, res.note]);
      setInternalNoteDraft("");
      try {
        await reloadTicket();
      } catch (reloadErr) {
        // Refresh failed rule: note was already saved, do NOT retry note creation
      }
    } catch (err: any) {
      setInternalNoteError(err?.message || "Failed to submit internal note");
    } finally {
      setIsSubmittingInternalNote(false);
    }
  };

  // Credentialed attachment download with ATTACHMENT_REMOVED/missing-file recovery
  const handleDownloadAttachment = async (att: any) => {
    setAttachmentDownloadError(null);
    setDownloadingAttachmentId(att.id);
    const rawUrl = att.downloadUrl || getAttachmentDownloadUrl(ticketId, att.id);
    const downloadUrl = rawUrl.startsWith("http://") || rawUrl.startsWith("https://")
      ? rawUrl
      : `${API_URL}${rawUrl.startsWith("/") ? "" : "/"}${rawUrl}`;

    try {
      const res = await downloadAttachmentByUrl(downloadUrl);
      if (!res.ok) {
        let errData: any = null;
        try {
          errData = await res.json();
        } catch (_) {
          // ignore
        }

        if (res.status === 403 || errData?.error?.code === "ATTACHMENT_REMOVED") {
          setAttachmentDownloadError("This attachment has been removed and is no longer available.");
        } else if (res.status === 404 || errData?.error?.code === "NOT_FOUND") {
          setAttachmentDownloadError("Attachment file could not be found on the server.");
        } else {
          setAttachmentDownloadError(errData?.error?.message || "Failed to download attachment.");
        }

        // Error recovery: refresh ticket metadata to reflect the updated attachment status
        try {
          await reloadTicket();
        } catch (_) {
          // ignore reload failure
        }
        return;
      }

      // Successful download
      const blob = await res.blob();
      const objectUrl = window.URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = objectUrl;
      link.download = att.originalName || att.fileName || "attachment";
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      window.URL.revokeObjectURL(objectUrl);
    } catch (err: any) {
      setAttachmentDownloadError(err?.message || "Network error while downloading attachment.");
      try {
        await reloadTicket();
      } catch (_) {
        // ignore
      }
    } finally {
      setDownloadingAttachmentId(null);
    }
  };

  if (loading) {
    return (
      <div style={{ textAlign: "center", padding: "80px 20px" }} data-testid="staff-detail-loading">
        <div
          className="spinner"
          style={{
            width: "36px",
            height: "36px",
            border: "3px solid #E2E8F0",
            borderTopColor: "var(--color-primary)",
            borderRadius: "50%",
            margin: "0 auto 16px",
            animation: "spin 1s linear infinite",
          }}
        />
        <p style={{ color: "var(--color-text-secondary)", fontSize: "15px" }}>
          Loading staff ticket details...
        </p>
      </div>
    );
  }

  if (statusCode === 403) {
    return (
      <div
        style={{
          backgroundColor: "#FEF2F2",
          border: "1px solid #FCA5A5",
          borderRadius: "8px",
          padding: "24px",
          color: "#991B1B",
          margin: "24px 0",
        }}
        data-testid="staff-detail-forbidden"
      >
        <h3 style={{ fontSize: "16px", fontWeight: "bold", marginBottom: "8px" }}>
          Access Denied (403 Forbidden)
        </h3>
        <p style={{ marginBottom: "16px", fontSize: "14px" }}>
          You do not have permission to view staff ticket operations.
        </p>
        <button
          type="button"
          onClick={onBack}
          data-testid="btn-back-to-queue"
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
          ← Back to Ticket Queue
        </button>
      </div>
    );
  }

  if (statusCode === 404 || (!ticket && !error)) {
    return (
      <div
        style={{
          backgroundColor: "#F8FAFC",
          border: "1px solid #CBD5E1",
          borderRadius: "8px",
          padding: "24px",
          color: "#475569",
          margin: "24px 0",
        }}
        data-testid="staff-detail-not-found"
      >
        <h3 style={{ fontSize: "16px", fontWeight: "bold", marginBottom: "8px" }}>
          Ticket Not Found (404)
        </h3>
        <p style={{ marginBottom: "16px", fontSize: "14px" }}>
          The requested ticket does not exist or has been removed.
        </p>
        <button
          type="button"
          onClick={onBack}
          data-testid="btn-back-to-queue"
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
          ← Back to Ticket Queue
        </button>
      </div>
    );
  }

  if (error || !ticket) {
    return (
      <div
        style={{
          backgroundColor: "#FEE2E2",
          border: "1px solid #FCA5A5",
          borderRadius: "8px",
          padding: "24px",
          color: "#991B1B",
          margin: "24px 0",
        }}
        data-testid="staff-detail-error"
      >
        <h3 style={{ fontSize: "16px", fontWeight: "bold", marginBottom: "8px" }}>
          Unable to Load Staff Ticket Details
        </h3>
        <p style={{ marginBottom: "16px", fontSize: "14px" }}>{error}</p>
        <div style={{ display: "flex", gap: "10px" }}>
          <button
            type="button"
            onClick={loadTicket}
            data-testid="btn-retry-load-detail"
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
            Retry Loading
          </button>
          <button
            type="button"
            onClick={onBack}
            data-testid="btn-back-to-queue"
            style={{
              padding: "8px 16px",
              backgroundColor: "#F1F5F9",
              color: "var(--color-text-secondary)",
              border: "none",
              borderRadius: "6px",
              fontWeight: 600,
              cursor: "pointer",
            }}
          >
            ← Back to Ticket Queue
          </button>
        </div>
      </div>
    );
  }

  const legalNextStatuses = STATUS_TRANSITIONS[ticket.status] || [];
  const activeAttachments = ticket.attachments?.filter((a) => !a.isRemoved) || [];
  const removedAttachments = ticket.attachments?.filter((a) => a.isRemoved) || [];

  return (
    <div style={{ maxWidth: "1100px", margin: "0 auto", paddingBottom: "48px" }}>
      {/* Top Navigation */}
      <div style={{ marginBottom: "20px" }}>
        <button
          type="button"
          onClick={onBack}
          data-testid="btn-back-to-queue"
          style={{
            background: "none",
            border: "none",
            color: "var(--color-secondary)",
            fontWeight: 600,
            fontSize: "14px",
            cursor: "pointer",
            display: "inline-flex",
            alignItems: "center",
            gap: "6px",
            padding: "6px 0",
          }}
        >
          ← Back to Ticket Queue
        </button>
      </div>

      {/* 409 Conflict Banner */}
      {conflictError && (
        <div
          data-testid="conflict-banner"
          style={{
            backgroundColor: "#FEF2F2",
            border: "1px solid #F87171",
            borderRadius: "8px",
            padding: "16px 20px",
            marginBottom: "20px",
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            gap: "12px",
            color: "#991B1B",
          }}
        >
          <div>
            <strong>Optimistic Concurrency Conflict</strong>
            <p style={{ margin: "4px 0 0", fontSize: "13.5px" }}>
              {conflictError}. Please reload to see latest data before retrying your update.
            </p>
          </div>
          <button
            type="button"
            data-testid="btn-reload-conflict"
            onClick={() => reloadTicket().catch(() => {})}
            style={{
              padding: "8px 16px",
              backgroundColor: "#DC2626",
              color: "white",
              border: "none",
              borderRadius: "6px",
              fontWeight: 600,
              fontSize: "13px",
              cursor: "pointer",
              whiteSpace: "nowrap",
            }}
          >
            Reload Ticket
          </button>
        </div>
      )}

      {/* Refresh Safety Failure Banner */}
      {refreshFailed && (
        <div
          data-testid="staff-refresh-failed-banner"
          style={{
            backgroundColor: "#FFFBEB",
            border: "1px solid #FCD34D",
            borderRadius: "8px",
            padding: "16px 20px",
            marginBottom: "20px",
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            gap: "12px",
            color: "#92400E",
          }}
        >
          <div>
            <strong>Refresh Failed</strong>
            <p style={{ margin: "4px 0 0", fontSize: "13.5px" }}>
              Your communication entry was saved successfully, but refreshing the ticket state failed.
              Action buttons are disabled until the ticket is reloaded.
            </p>
          </div>
          <button
            type="button"
            data-testid="btn-reload-staff-ticket"
            onClick={() => reloadTicket().catch(() => {})}
            style={{
              padding: "8px 16px",
              backgroundColor: "#D97706",
              color: "white",
              border: "none",
              borderRadius: "6px",
              fontWeight: 600,
              fontSize: "13px",
              cursor: "pointer",
              whiteSpace: "nowrap",
            }}
          >
            Reload Ticket
          </button>
        </div>
      )}

      {/* Main Staff Container */}
      <div
        style={{
          backgroundColor: "var(--color-surface)",
          borderRadius: "var(--radius)",
          border: "1px solid var(--color-border)",
          boxShadow: "0 1px 3px rgba(0,0,0,0.05)",
          overflow: "hidden",
        }}
      >
        {/* Ticket Header */}
        <div
          style={{
            padding: "20px 24px",
            borderBottom: "1px solid var(--color-border)",
            backgroundColor: "#FAFCFA",
            display: "flex",
            flexWrap: "wrap",
            justifyContent: "space-between",
            alignItems: "center",
            gap: "12px",
          }}
        >
          <div>
            <div style={{ display: "flex", alignItems: "center", gap: "12px", marginBottom: "6px" }}>
              <h1
                style={{
                  fontSize: "22px",
                  fontWeight: 700,
                  color: "var(--color-text-primary)",
                  margin: 0,
                }}
                data-testid="staff-ticket-number-heading"
              >
                {ticket.ticketNumber}
              </h1>
              {renderStatusBadge(ticket.status)}
              {renderPriorityBadge(ticket.requestedPriority, "requested-priority-badge")}
              {renderPriorityBadge(ticket.itPriority, "it-priority-badge")}
            </div>
            <div style={{ fontSize: "13px", color: "var(--color-text-secondary)" }}>
              Submitted on {formatDate(ticket.createdAt)} • Version {ticket.version ?? 0}
            </div>
          </div>

          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: "8px",
              backgroundColor: "var(--color-pale-green)",
              padding: "6px 12px",
              borderRadius: "6px",
              fontSize: "13px",
              color: "var(--color-primary)",
              fontWeight: 600,
            }}
          >
            👤 Requester: {ticket.requester.name} ({ticket.requester.department || "No Dept"})
          </div>
        </div>

        {/* Content Body */}
        <div style={{ padding: "24px" }}>
          {/* Problem Appears Resolved Notice if indicated by requester */}
          {ticket.problemAppearsResolvedAt && (
            <div
              data-testid="requester-resolution-notice"
              style={{
                backgroundColor: "#ECFDF5",
                border: "1px solid #A7F3D0",
                borderRadius: "8px",
                padding: "12px 16px",
                marginBottom: "20px",
                display: "flex",
                alignItems: "center",
                gap: "10px",
                color: "#065F46",
              }}
            >
              <span style={{ fontSize: "18px" }}>✓</span>
              <div>
                <strong>Requester indicated problem appears resolved</strong>
                <div style={{ fontSize: "12px", color: "#047857" }}>
                  Reported on {formatDate(ticket.problemAppearsResolvedAt)}
                </div>
              </div>
            </div>
          )}

          {/* Operational Controls Card */}
          <div
            style={{
              backgroundColor: "#F8FAFC",
              border: "1px solid var(--color-border)",
              borderRadius: "8px",
              padding: "18px 20px",
              marginBottom: "24px",
            }}
            data-testid="operational-card"
          >
            <h2 style={{ fontSize: "15px", fontWeight: 700, margin: "0 0 16px 0", color: "var(--color-text-primary)" }}>
              Operational Controls
            </h2>

            <div
              style={{
                display: "grid",
                gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))",
                gap: "20px",
              }}
            >
              {/* Owner Assignment & Claim */}
              <div style={{ backgroundColor: "#FFFFFF", padding: "14px", borderRadius: "6px", border: "1px solid var(--color-border)" }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "8px" }}>
                  <label style={{ fontSize: "12.5px", fontWeight: 700, color: "var(--color-text-secondary)", textTransform: "uppercase" }}>
                    Assigned Owner
                  </label>
                  {!ticket.owner && (
                    <button
                      type="button"
                      data-testid="btn-claim-ticket"
                      onClick={handleClaim}
                      disabled={isClaiming || refreshFailed}
                      style={{
                        padding: "4px 10px",
                        backgroundColor: "var(--color-primary)",
                        color: "white",
                        border: "none",
                        borderRadius: "4px",
                        fontSize: "12px",
                        fontWeight: 600,
                        cursor: isClaiming || refreshFailed ? "not-allowed" : "pointer",
                      }}
                    >
                      {isClaiming ? "Claiming..." : "Claim Ticket"}
                    </button>
                  )}
                </div>

                <div
                  data-testid="owner-display"
                  style={{
                    fontSize: "14px",
                    fontWeight: 600,
                    marginBottom: "12px",
                    color: ticket.owner ? "var(--color-text-primary)" : "#DC2626",
                  }}
                >
                  {ticket.owner ? `${ticket.owner.name} (${ticket.owner.role === "ADMINISTRATOR" ? "Admin" : "IT Staff"})` : "Unassigned"}
                </div>

                {claimError && (
                  <div style={{ color: "var(--color-error)", fontSize: "12px", marginBottom: "8px" }}>
                    {claimError}
                  </div>
                )}

                {/* Reassignment Selector */}
                <div style={{ display: "flex", gap: "8px", alignItems: "center" }}>
                  <select
                    data-testid="select-owner"
                    value={selectedOwnerId}
                    disabled={ownersLoading || isSavingOwner || refreshFailed}
                    onChange={(e) => {
                      setSelectedOwnerId(e.target.value);
                      if (ownerError) setOwnerError(null);
                    }}
                    style={{
                      flex: 1,
                      padding: "6px 10px",
                      borderRadius: "6px",
                      border: ownerError ? "1px solid var(--color-error)" : "1px solid var(--color-input-border)",
                      fontSize: "13px",
                    }}
                  >
                    <option value="">Unassigned</option>
                    {eligibleOwners.map((o) => (
                      <option key={o.id} value={String(o.id)}>
                        {o.name} ({o.role === "ADMINISTRATOR" ? "Admin" : "IT Staff"})
                      </option>
                    ))}
                  </select>

                  <button
                    type="button"
                    data-testid="btn-save-owner"
                    onClick={handleSaveOwner}
                    disabled={ownersLoading || isSavingOwner || refreshFailed}
                    style={{
                      padding: "6px 12px",
                      backgroundColor: "var(--color-primary)",
                      color: "white",
                      border: "none",
                      borderRadius: "6px",
                      fontSize: "12.5px",
                      fontWeight: 600,
                      cursor: ownersLoading || isSavingOwner || refreshFailed ? "not-allowed" : "pointer",
                      opacity: ownersLoading || isSavingOwner || refreshFailed ? 0.6 : 1,
                    }}
                  >
                    {isSavingOwner ? "Saving..." : "Save"}
                  </button>
                </div>

                {ownerError && (
                  <div data-testid="owner-error-callout" style={{ color: "var(--color-error)", fontSize: "12px", marginTop: "6px" }}>
                    {ownerError}
                  </div>
                )}
                {ownersError && (
                  <div style={{ color: "#D97706", fontSize: "12px", marginTop: "6px" }}>
                    Failed to load owners. <button type="button" onClick={loadOwners}>Retry</button>
                  </div>
                )}
              </div>

              {/* IT Priority */}
              <div style={{ backgroundColor: "#FFFFFF", padding: "14px", borderRadius: "6px", border: "1px solid var(--color-border)" }}>
                <label style={{ display: "block", fontSize: "12.5px", fontWeight: 700, color: "var(--color-text-secondary)", textTransform: "uppercase", marginBottom: "8px" }}>
                  IT Priority
                </label>

                <div style={{ display: "flex", gap: "8px", alignItems: "center" }}>
                  <select
                    data-testid="select-it-priority"
                    value={selectedItPriority}
                    disabled={isSavingItPriority || refreshFailed}
                    onChange={(e) => {
                      setSelectedItPriority(e.target.value as Priority);
                      if (itPriorityError) setItPriorityError(null);
                    }}
                    style={{
                      flex: 1,
                      padding: "6px 10px",
                      borderRadius: "6px",
                      border: "1px solid var(--color-input-border)",
                      fontSize: "13px",
                    }}
                  >
                    <option value="LOW">LOW</option>
                    <option value="MEDIUM">MEDIUM</option>
                    <option value="HIGH">HIGH</option>
                    <option value="URGENT">URGENT</option>
                  </select>

                  <button
                    type="button"
                    data-testid="btn-save-it-priority"
                    onClick={handleSaveItPriority}
                    disabled={isSavingItPriority || refreshFailed}
                    style={{
                      padding: "6px 12px",
                      backgroundColor: "var(--color-primary)",
                      color: "white",
                      border: "none",
                      borderRadius: "6px",
                      fontSize: "12.5px",
                      fontWeight: 600,
                      cursor: isSavingItPriority || refreshFailed ? "not-allowed" : "pointer",
                      opacity: isSavingItPriority || refreshFailed ? 0.6 : 1,
                    }}
                  >
                    {isSavingItPriority ? "Saving..." : "Save"}
                  </button>
                </div>

                {itPriorityError && (
                  <div style={{ color: "var(--color-error)", fontSize: "12px", marginTop: "6px" }}>
                    {itPriorityError}
                  </div>
                )}
              </div>

              {/* Status Transition */}
              <div style={{ backgroundColor: "#FFFFFF", padding: "14px", borderRadius: "6px", border: "1px solid var(--color-border)" }}>
                <label style={{ display: "block", fontSize: "12.5px", fontWeight: 700, color: "var(--color-text-secondary)", textTransform: "uppercase", marginBottom: "8px" }}>
                  Next Status
                </label>

                <div style={{ display: "flex", gap: "8px", alignItems: "center" }}>
                  <select
                    data-testid="select-status"
                    value={selectedStatus}
                    disabled={legalNextStatuses.length === 0 || isSavingStatus || refreshFailed}
                    onChange={(e) => {
                      setSelectedStatus(e.target.value as TicketStatus);
                      if (statusError) setStatusError(null);
                      if (statusOwnerRequiredError) setStatusOwnerRequiredError(null);
                    }}
                    style={{
                      flex: 1,
                      padding: "6px 10px",
                      borderRadius: "6px",
                      border: statusError || statusOwnerRequiredError ? "1px solid var(--color-error)" : "1px solid var(--color-input-border)",
                      fontSize: "13px",
                    }}
                  >
                    {legalNextStatuses.length === 0 ? (
                      <option value="">No transitions</option>
                    ) : (
                      legalNextStatuses.map((s) => (
                        <option key={s} value={s}>
                          {s} {CONFIRMATION_STATUSES.includes(s) ? "(Requires confirmation)" : ""}
                        </option>
                      ))
                    )}
                  </select>

                  <button
                    type="button"
                    ref={statusTriggerRef}
                    data-testid="btn-save-status"
                    onClick={handleStatusChangeClick}
                    disabled={legalNextStatuses.length === 0 || isSavingStatus || refreshFailed}
                    style={{
                      padding: "6px 12px",
                      backgroundColor: "var(--color-primary)",
                      color: "white",
                      border: "none",
                      borderRadius: "6px",
                      fontSize: "12.5px",
                      fontWeight: 600,
                      cursor: legalNextStatuses.length === 0 || isSavingStatus || refreshFailed ? "not-allowed" : "pointer",
                      opacity: legalNextStatuses.length === 0 || isSavingStatus || refreshFailed ? 0.6 : 1,
                    }}
                  >
                    {isSavingStatus ? "Updating..." : "Update Status"}
                  </button>
                </div>

                {statusOwnerRequiredError && (
                  <div data-testid="status-owner-required-error" style={{ color: "var(--color-error)", fontSize: "12px", marginTop: "6px" }}>
                    {statusOwnerRequiredError}
                  </div>
                )}

                {statusError && (
                  <div style={{ color: "var(--color-error)", fontSize: "12px", marginTop: "6px" }}>
                    {statusError}
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Requester Submission Panel */}
          <div style={{ marginBottom: "28px" }}>
            <h2 style={{ fontSize: "16px", fontWeight: 700, marginBottom: "14px", color: "var(--color-text-primary)" }}>
              Ticket Details & Description
            </h2>

            <div
              style={{
                display: "grid",
                gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))",
                gap: "16px",
                marginBottom: "16px",
              }}
            >
              <div>
                <span style={{ display: "block", fontSize: "12px", fontWeight: 600, color: "var(--color-text-secondary)", marginBottom: "4px" }}>
                  Category
                </span>
                <div style={{ backgroundColor: "#F8FAFC", border: "1px solid var(--color-border)", borderRadius: "6px", padding: "8px 12px", fontSize: "14px" }}>
                  {ticket.category?.name}
                </div>
              </div>

              <div>
                <span style={{ display: "block", fontSize: "12px", fontWeight: 600, color: "var(--color-text-secondary)", marginBottom: "4px" }}>
                  Related System
                </span>
                <div style={{ backgroundColor: "#F8FAFC", border: "1px solid var(--color-border)", borderRadius: "6px", padding: "8px 12px", fontSize: "14px" }}>
                  {ticket.relatedSystem?.name}
                </div>
              </div>
            </div>

            <div style={{ marginBottom: "16px" }}>
              <span style={{ display: "block", fontSize: "12px", fontWeight: 600, color: "var(--color-text-secondary)", marginBottom: "4px" }}>
                Summary
              </span>
              <div style={{ backgroundColor: "#F8FAFC", border: "1px solid var(--color-border)", borderRadius: "6px", padding: "10px 14px", fontSize: "14px", fontWeight: 600 }}>
                {ticket.summary}
              </div>
            </div>

            <div>
              <span style={{ display: "block", fontSize: "12px", fontWeight: 600, color: "var(--color-text-secondary)", marginBottom: "4px" }}>
                Description
              </span>
              <div style={{ backgroundColor: "#F8FAFC", border: "1px solid var(--color-border)", borderRadius: "6px", padding: "14px", fontSize: "14px", whiteSpace: "pre-wrap", lineHeight: "1.6" }}>
                {ticket.description}
              </div>
            </div>
          </div>

          {/* Attachments Section */}
          <div style={{ borderTop: "1px solid var(--color-border)", paddingTop: "24px", marginBottom: "28px" }}>
            <h2 style={{ fontSize: "16px", fontWeight: 700, marginBottom: "12px", color: "var(--color-text-primary)" }}>
              Attachments ({activeAttachments.length} active)
            </h2>

            {/* Download error callout */}
            {attachmentDownloadError && (
              <div
                role="alert"
                data-testid="attachment-download-error"
                style={{
                  marginBottom: "14px",
                  padding: "10px 14px",
                  borderRadius: "6px",
                  backgroundColor: "#FEF2F2",
                  border: "1px solid #FCA5A5",
                  color: "#991B1B",
                  fontSize: "13px",
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "center",
                }}
              >
                <span>{attachmentDownloadError}</span>
                <button
                  type="button"
                  onClick={() => setAttachmentDownloadError(null)}
                  style={{
                    background: "transparent",
                    border: "none",
                    cursor: "pointer",
                    color: "#991B1B",
                    fontWeight: "bold",
                    fontSize: "14px",
                    marginLeft: "8px",
                  }}
                  aria-label="Dismiss download error"
                >
                  ✕
                </button>
              </div>
            )}

            {ticket.attachments?.length === 0 ? (
              <div style={{ padding: "16px", backgroundColor: "#FAFCFA", border: "1px dashed var(--color-border)", borderRadius: "6px", textAlign: "center", color: "var(--color-text-secondary)", fontSize: "13.5px" }}>
                No attachments uploaded for this ticket.
              </div>
            ) : (
              <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
                {ticket.attachments?.map((att) => {
                  if (att.isRemoved) {
                    return (
                      <div
                        key={att.id}
                        data-testid={`attachment-removed-${att.id}`}
                        style={{
                          backgroundColor: "#F8FAFC",
                          border: "1px dashed #CBD5E1",
                          borderRadius: "6px",
                          padding: "10px 14px",
                          display: "flex",
                          justifyContent: "space-between",
                          alignItems: "center",
                          flexWrap: "wrap",
                          gap: "10px",
                          opacity: 0.8,
                        }}
                      >
                        <div>
                          <span style={{ textDecoration: "line-through", color: "#64748B", fontWeight: 600, fontSize: "13.5px" }}>
                            {att.originalName}
                          </span>
                          <span style={{ marginLeft: "8px", fontSize: "11px", backgroundColor: "#FEE2E2", color: "#DC2626", padding: "2px 6px", borderRadius: "4px", fontWeight: 700 }}>
                            Removed
                          </span>
                          <div style={{ fontSize: "12px", color: "#64748B", marginTop: "2px" }}>
                            {formatFileSize(att.fileSize)} • Uploaded {formatDate(att.createdAt)}
                          </div>
                          {att.removalReason && (
                            <div style={{ fontSize: "12px", color: "#991B1B", marginTop: "4px" }}>
                              <strong>Reason:</strong> {att.removalReason}
                            </div>
                          )}
                        </div>
                        <div
                          data-testid={`attachment-removed-unavailable-${att.id}`}
                          style={{ fontSize: "12px", color: "#94A3B8", fontStyle: "italic" }}
                        >
                          Download unavailable
                        </div>
                      </div>
                    );
                  }

                  return (
                    <div
                      key={att.id}
                      data-testid={`attachment-active-${att.id}`}
                      style={{
                        backgroundColor: "#FFFFFF",
                        border: "1px solid var(--color-border)",
                        borderRadius: "6px",
                        padding: "10px 14px",
                        display: "flex",
                        justifyContent: "space-between",
                        alignItems: "center",
                        flexWrap: "wrap",
                        gap: "10px",
                      }}
                    >
                      <div>
                        <span style={{ fontWeight: 600, fontSize: "13.5px", color: "var(--color-text-primary)" }}>
                          {att.originalName}
                        </span>
                        <div style={{ fontSize: "12px", color: "var(--color-text-secondary)", marginTop: "2px" }}>
                          {formatFileSize(att.fileSize)} • Uploaded {formatDate(att.createdAt)}
                        </div>
                      </div>

                      <button
                        type="button"
                        onClick={() => handleDownloadAttachment(att)}
                        disabled={downloadingAttachmentId === att.id}
                        data-testid={`btn-staff-download-${att.id}`}
                        style={{
                          padding: "6px 12px",
                          backgroundColor: "var(--color-pale-green)",
                          color: "var(--color-primary)",
                          borderRadius: "6px",
                          fontSize: "12.5px",
                          fontWeight: 600,
                          border: "1px solid #C6E7D2",
                          cursor: downloadingAttachmentId === att.id ? "wait" : "pointer",
                        }}
                      >
                        {downloadingAttachmentId === att.id ? "Downloading..." : "⬇ Download"}
                      </button>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* Communication Sections: Public Comments & Internal Notes */}
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(auto-fit, minmax(400px, 1fr))",
              gap: "24px",
              borderTop: "1px solid var(--color-border)",
              paddingTop: "24px",
            }}
          >
            {/* Public Comments (Green Styling) */}
            <div
              style={{
                backgroundColor: "#F0FDF4",
                border: "1px solid #BBF7D0",
                borderRadius: "8px",
                padding: "18px",
              }}
              data-testid="staff-public-comments-section"
            >
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "14px" }}>
                <h3 style={{ fontSize: "15px", fontWeight: 700, margin: 0, color: "#166534" }}>
                  Public Comments ({publicComments.length})
                </h3>
                <span style={{ fontSize: "11px", fontWeight: 700, backgroundColor: "#DCFCE7", color: "#166534", padding: "2px 8px", borderRadius: "12px" }}>
                  Public
                </span>
              </div>

              {/* Comments Timeline */}
              <div style={{ display: "flex", flexDirection: "column", gap: "10px", marginBottom: "16px", maxHeight: "300px", overflowY: "auto" }}>
                {publicComments.length === 0 ? (
                  <div style={{ fontSize: "13px", color: "#166534", fontStyle: "italic", textAlign: "center", padding: "12px" }}>
                    No public comments yet.
                  </div>
                ) : (
                  publicComments.map((c) => (
                    <div
                      key={c.id}
                      style={{
                        backgroundColor: "#FFFFFF",
                        border: "1px solid #BBF7D0",
                        borderRadius: "6px",
                        padding: "10px 12px",
                      }}
                    >
                      <div style={{ display: "flex", justifyContent: "space-between", fontSize: "12px", marginBottom: "4px" }}>
                        <strong>{c.author?.name || (c as any).authorName || "User"} {c.author?.role ? `(${c.author.role})` : (c as any).authorRole ? `(${(c as any).authorRole})` : ""}</strong>
                        <span style={{ color: "#64748B" }}>{formatDate(c.createdAt)}</span>
                      </div>
                      <div style={{ fontSize: "13.5px", color: "var(--color-text-primary)", whiteSpace: "pre-wrap" }}>
                        {c.content}
                      </div>
                    </div>
                  ))
                )}
              </div>

              {/* Public Comment Composer */}
              <form onSubmit={handleSubmitPublicComment}>
                <textarea
                  data-testid="input-staff-public-comment"
                  value={publicCommentDraft}
                  onChange={(e) => {
                    setPublicCommentDraft(e.target.value);
                    if (publicCommentError) setPublicCommentError(null);
                  }}
                  disabled={isSubmittingPublicComment || refreshFailed}
                  placeholder="Post comment visible to requester..."
                  rows={3}
                  style={{
                    width: "100%",
                    padding: "8px 10px",
                    borderRadius: "6px",
                    border: publicCommentError ? "1px solid var(--color-error)" : "1px solid #86EFAC",
                    fontSize: "13px",
                    fontFamily: "inherit",
                    resize: "vertical",
                  }}
                />
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginTop: "4px" }}>
                  <span style={{ fontSize: "11.5px", color: "#166534" }}>
                    {Array.from(publicCommentDraft.trim()).length} / 2000
                  </span>
                  <button
                    type="submit"
                    data-testid="btn-submit-staff-public-comment"
                    disabled={isSubmittingPublicComment || !publicCommentDraft.trim() || refreshFailed}
                    style={{
                      padding: "6px 14px",
                      backgroundColor: "#166534",
                      color: "white",
                      border: "none",
                      borderRadius: "6px",
                      fontSize: "12.5px",
                      fontWeight: 600,
                      cursor: isSubmittingPublicComment || !publicCommentDraft.trim() || refreshFailed ? "not-allowed" : "pointer",
                      opacity: isSubmittingPublicComment || !publicCommentDraft.trim() || refreshFailed ? 0.6 : 1,
                    }}
                  >
                    {isSubmittingPublicComment ? "Posting..." : "Post Public Comment"}
                  </button>
                </div>
                {publicCommentError && (
                  <div data-testid="staff-public-comment-error" style={{ color: "var(--color-error)", fontSize: "12px", marginTop: "6px" }}>
                    {publicCommentError}
                  </div>
                )}
              </form>
            </div>

            {/* Internal Notes (Amber Styling) */}
            <div
              style={{
                backgroundColor: "#FEF3C7",
                border: "1px solid #FDE68A",
                borderRadius: "8px",
                padding: "18px",
              }}
              data-testid="staff-internal-notes-section"
            >
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "14px" }}>
                <h3 style={{ fontSize: "15px", fontWeight: 700, margin: 0, color: "#92400E" }}>
                  Internal Notes ({internalNotes.length})
                </h3>
                <span style={{ fontSize: "11px", fontWeight: 700, backgroundColor: "#FDE68A", color: "#92400E", padding: "2px 8px", borderRadius: "12px" }}>
                  Private - IT Staff & Admin
                </span>
              </div>

              {/* Internal Notes Timeline */}
              <div style={{ display: "flex", flexDirection: "column", gap: "10px", marginBottom: "16px", maxHeight: "300px", overflowY: "auto" }}>
                {internalNotes.length === 0 ? (
                  <div style={{ fontSize: "13px", color: "#92400E", fontStyle: "italic", textAlign: "center", padding: "12px" }}>
                    No internal notes yet.
                  </div>
                ) : (
                  internalNotes.map((n) => (
                    <div
                      key={n.id}
                      style={{
                        backgroundColor: "#FFFFFF",
                        border: "1px solid #FDE68A",
                        borderRadius: "6px",
                        padding: "10px 12px",
                      }}
                    >
                      <div style={{ display: "flex", justifyContent: "space-between", fontSize: "12px", marginBottom: "4px" }}>
                        <strong>{n.author?.name || (n as any).authorName || "Staff"} {n.author?.role ? `(${n.author.role})` : (n as any).authorRole ? `(${(n as any).authorRole})` : ""}</strong>
                        <span style={{ color: "#64748B" }}>{formatDate(n.createdAt)}</span>
                      </div>
                      <div style={{ fontSize: "13.5px", color: "var(--color-text-primary)", whiteSpace: "pre-wrap" }}>
                        {n.content}
                      </div>
                    </div>
                  ))
                )}
              </div>

              {/* Internal Note Composer */}
              <form onSubmit={handleSubmitInternalNote}>
                <textarea
                  data-testid="input-internal-note"
                  value={internalNoteDraft}
                  onChange={(e) => {
                    setInternalNoteDraft(e.target.value);
                    if (internalNoteError) setInternalNoteError(null);
                  }}
                  disabled={isSubmittingInternalNote || refreshFailed}
                  placeholder="Add private note for IT Staff and Admins only..."
                  rows={3}
                  style={{
                    width: "100%",
                    padding: "8px 10px",
                    borderRadius: "6px",
                    border: internalNoteError ? "1px solid var(--color-error)" : "1px solid #FCD34D",
                    fontSize: "13px",
                    fontFamily: "inherit",
                    resize: "vertical",
                  }}
                />
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginTop: "4px" }}>
                  <span style={{ fontSize: "11.5px", color: "#92400E" }}>
                    {Array.from(internalNoteDraft.trim()).length} / 2000
                  </span>
                  <button
                    type="submit"
                    data-testid="btn-submit-internal-note"
                    disabled={isSubmittingInternalNote || !internalNoteDraft.trim() || refreshFailed}
                    style={{
                      padding: "6px 14px",
                      backgroundColor: "#B45309",
                      color: "white",
                      border: "none",
                      borderRadius: "6px",
                      fontSize: "12.5px",
                      fontWeight: 600,
                      cursor: isSubmittingInternalNote || !internalNoteDraft.trim() || refreshFailed ? "not-allowed" : "pointer",
                      opacity: isSubmittingInternalNote || !internalNoteDraft.trim() || refreshFailed ? 0.6 : 1,
                    }}
                  >
                    {isSubmittingInternalNote ? "Saving..." : "Save Internal Note"}
                  </button>
                </div>
                {internalNoteError && (
                  <div data-testid="internal-note-error" style={{ color: "var(--color-error)", fontSize: "12px", marginTop: "6px" }}>
                    {internalNoteError}
                  </div>
                )}
              </form>
            </div>
          </div>
        </div>
      </div>

      {/* Accessible Status Confirmation Dialog */}
      {statusModalOpen && targetStatus && (
        <div
          style={{
            position: "fixed",
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            backgroundColor: "rgba(0, 0, 0, 0.5)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            padding: "16px",
            zIndex: 1000,
          }}
        >
          <div
            ref={statusModalRef}
            role="dialog"
            aria-modal="true"
            aria-labelledby="confirm-status-dialog-title"
            style={{
              backgroundColor: "white",
              borderRadius: "12px",
              padding: "24px",
              maxWidth: "480px",
              width: "100%",
              boxShadow: "0 10px 25px rgba(0,0,0,0.2)",
            }}
            data-testid="status-confirmation-dialog"
          >
            <h3
              id="confirm-status-dialog-title"
              style={{
                fontSize: "18px",
                fontWeight: 700,
                color: "var(--color-text-primary)",
                marginBottom: "8px",
              }}
            >
              Confirm Status Transition to {targetStatus}
            </h3>
            <p style={{ fontSize: "14px", color: "var(--color-text-secondary)", marginBottom: "16px" }}>
              Are you sure you want to transition ticket {ticket.ticketNumber} from <strong>{ticket.status}</strong> to <strong>{targetStatus}</strong>?
              This state transition requires formal confirmation.
            </p>

            {statusError && (
              <div
                style={{
                  backgroundColor: "#FEE2E2",
                  color: "#991B1B",
                  padding: "8px 12px",
                  borderRadius: "6px",
                  fontSize: "13px",
                  marginBottom: "16px",
                }}
              >
                {statusError}
              </div>
            )}

            <div style={{ display: "flex", justifyContent: "flex-end", gap: "10px" }}>
              <button
                type="button"
                disabled={isConfirmingStatus}
                onClick={handleCloseStatusModal}
                data-testid="btn-cancel-status-modal"
                style={{
                  padding: "8px 16px",
                  backgroundColor: "#F1F5F9",
                  color: "var(--color-text-secondary)",
                  border: "none",
                  borderRadius: "6px",
                  fontWeight: 600,
                  fontSize: "13px",
                  cursor: isConfirmingStatus ? "not-allowed" : "pointer",
                }}
              >
                Cancel
              </button>

              <button
                type="button"
                disabled={isConfirmingStatus}
                onClick={handleConfirmStatusModal}
                data-testid="btn-confirm-status-modal"
                style={{
                  padding: "8px 16px",
                  backgroundColor: "var(--color-primary)",
                  color: "white",
                  border: "none",
                  borderRadius: "6px",
                  fontWeight: 600,
                  fontSize: "13px",
                  cursor: isConfirmingStatus ? "not-allowed" : "pointer",
                  opacity: isConfirmingStatus ? 0.6 : 1,
                }}
              >
                {isConfirmingStatus ? "Confirming..." : "Confirm Status Change"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
