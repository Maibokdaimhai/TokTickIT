import React, { useState, useEffect, useRef } from "react";
import { useRequester } from "../context/RequesterContext.js";
import { TicketDetail, Attachment } from "../types.js";
import {
  fetchTicketDetail,
  removeAttachment,
  uploadAttachment,
  getAttachmentDownloadUrl,
} from "../api.js";

interface TicketDetailPageProps {
  ticketId: number;
  onBack: () => void;
}

export const TicketDetailPage: React.FC<TicketDetailPageProps> = ({ ticketId, onBack }) => {
  const { selectedRequester } = useRequester();
  const [ticket, setTicket] = useState<TicketDetail | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  // Soft-removal modal state
  const [targetAttachment, setTargetAttachment] = useState<Attachment | null>(null);
  const [removalReason, setRemovalReason] = useState<string>("");
  const [removalError, setRemovalError] = useState<string | null>(null);
  const [isRemoving, setIsRemoving] = useState<boolean>(false);

  // Upload new attachment state
  const [isUploading, setIsUploading] = useState<boolean>(false);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const loadTicket = async () => {
    if (!selectedRequester) return;
    setIsLoading(true);
    setError(null);
    try {
      const data = await fetchTicketDetail(ticketId, selectedRequester.id);
      setTicket(data);
    } catch (err: any) {
      setError(err?.message || "Failed to load ticket details");
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadTicket();
  }, [ticketId, selectedRequester?.id]);

  const formatFileSize = (bytes: number) => {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  };

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

  const handleOpenRemovalModal = (att: Attachment) => {
    setTargetAttachment(att);
    setRemovalReason("");
    setRemovalError(null);
  };

  const handleCloseRemovalModal = () => {
    if (isRemoving) return;
    setTargetAttachment(null);
    setRemovalReason("");
    setRemovalError(null);
  };

  const handleConfirmRemoval = async () => {
    const trimmed = removalReason.trim();
    if (!trimmed || trimmed.length < 3) {
      setRemovalError("Removal reason must be at least 3 characters long.");
      return;
    }

    if (!selectedRequester || !targetAttachment) return;

    setIsRemoving(true);
    setRemovalError(null);

    try {
      const updatedAtt = await removeAttachment(
        ticketId,
        targetAttachment.id,
        selectedRequester.id,
        trimmed
      );

      // Update local ticket state in-place
      setTicket((prev) => {
        if (!prev) return null;
        return {
          ...prev,
          attachments: prev.attachments.map((att) =>
            att.id === updatedAtt.id ? { ...att, ...updatedAtt } : att
          ),
        };
      });

      setTargetAttachment(null);
      setRemovalReason("");
    } catch (err: any) {
      setRemovalError(err?.message || "Failed to remove attachment");
    } finally {
      setIsRemoving(false);
    }
  };

  const handleFileSelected = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Reset input value so same file can be re-selected if needed
    e.target.value = "";

    const ALLOWED_MIME_TYPES = ["image/jpeg", "image/png", "image/webp", "application/pdf"];
    if (!ALLOWED_MIME_TYPES.includes(file.type)) {
      setUploadError("Only image (JPEG, PNG, WebP) and PDF files are allowed.");
      return;
    }

    if (file.size > 5 * 1024 * 1024) {
      setUploadError("File size exceeds the 5 MB limit.");
      return;
    }

    if (!selectedRequester) return;

    setIsUploading(true);
    setUploadError(null);

    try {
      const newAtt = await uploadAttachment(ticketId, file, selectedRequester.id);
      setTicket((prev) => {
        if (!prev) return null;
        return {
          ...prev,
          attachments: [...prev.attachments, newAtt],
        };
      });
    } catch (err: any) {
      setUploadError(err?.message || "Failed to upload attachment");
    } finally {
      setIsUploading(false);
    }
  };

  if (isLoading) {
    return (
      <div style={{ textAlign: "center", padding: "80px 20px" }} data-testid="detail-loading">
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
          Loading ticket details...
        </p>
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
        data-testid="detail-error"
      >
        <h3 style={{ fontSize: "16px", fontWeight: "bold", marginBottom: "8px" }}>
          Unable to display ticket
        </h3>
        <p style={{ marginBottom: "16px", fontSize: "14px" }}>
          {error || "Ticket not found or access was denied."}
        </p>
        <button
          type="button"
          onClick={onBack}
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
          ← Back to My Tickets
        </button>
      </div>
    );
  }

  const activeAttachments = ticket.attachments.filter((a) => !a.isRemoved);
  const removedAttachments = ticket.attachments.filter((a) => a.isRemoved);
  const activeCount = activeAttachments.length;
  const canUploadMore = activeCount < 5;

  const renderStatusBadge = (status: string) => {
    switch (status) {
      case "NEW":
        return (
          <span
            style={{
              backgroundColor: "#E0F2FE",
              color: "#0369A1",
              padding: "4px 10px",
              borderRadius: "16px",
              fontSize: "12px",
              fontWeight: 700,
              display: "inline-flex",
              alignItems: "center",
              gap: "4px",
            }}
          >
            ● NEW
          </span>
        );
      case "IN_PROGRESS":
        return (
          <span
            style={{
              backgroundColor: "var(--color-warning-bg)",
              color: "var(--color-warning-text)",
              padding: "4px 10px",
              borderRadius: "16px",
              fontSize: "12px",
              fontWeight: 700,
              display: "inline-flex",
              alignItems: "center",
              gap: "4px",
            }}
          >
            ⟳ In Progress
          </span>
        );
      case "RESOLVED":
        return (
          <span
            style={{
              backgroundColor: "var(--color-success-bg)",
              color: "var(--color-success-text)",
              padding: "4px 10px",
              borderRadius: "16px",
              fontSize: "12px",
              fontWeight: 700,
              display: "inline-flex",
              alignItems: "center",
              gap: "4px",
            }}
          >
            ✓ Resolved
          </span>
        );
      case "CLOSED":
        return (
          <span
            style={{
              backgroundColor: "#F3F4F6",
              color: "#4B5563",
              padding: "4px 10px",
              borderRadius: "16px",
              fontSize: "12px",
              fontWeight: 700,
              display: "inline-flex",
              alignItems: "center",
              gap: "4px",
            }}
          >
            🔒 Closed
          </span>
        );
      default:
        return <span>{status}</span>;
    }
  };

  const renderPriorityBadge = (priority: string) => {
    const priorityColors: Record<string, { bg: string; text: string }> = {
      LOW: { bg: "#F3F4F6", text: "#4B5563" },
      MEDIUM: { bg: "#FEF3C7", text: "#B45309" },
      HIGH: { bg: "#FFEDD5", text: "#C2410C" },
      URGENT: { bg: "#FEE2E2", text: "#B91C1C" },
    };
    const c = priorityColors[priority] || priorityColors.LOW;
    return (
      <span
        style={{
          backgroundColor: c.bg,
          color: c.text,
          padding: "4px 10px",
          borderRadius: "16px",
          fontSize: "12px",
          fontWeight: 700,
        }}
      >
        {priority}
      </span>
    );
  };

  return (
    <div style={{ maxWidth: "1000px", margin: "0 auto", paddingBottom: "48px" }}>
      {/* Navigation Top Bar */}
      <div style={{ marginBottom: "20px" }}>
        <button
          type="button"
          onClick={onBack}
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
          data-testid="btn-back-to-tickets"
        >
          ← Back to My Tickets
        </button>
      </div>

      {/* Main Ticket Card */}
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
            <div style={{ display: "flex", alignItems: "center", gap: "12px", marginBottom: "4px" }}>
              <h1
                style={{
                  fontSize: "22px",
                  fontWeight: 700,
                  color: "var(--color-text-primary)",
                  margin: 0,
                }}
                data-testid="ticket-number-heading"
              >
                {ticket.ticketNumber}
              </h1>
              {renderStatusBadge(ticket.status)}
              {renderPriorityBadge(ticket.requestedPriority)}
            </div>
            <div style={{ fontSize: "13px", color: "var(--color-text-secondary)" }}>
              Submitted on {formatDate(ticket.createdAt)}
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
            👤 {ticket.requester.name} ({ticket.requester.department})
          </div>
        </div>

        {/* Read-Only Information Grid */}
        <div style={{ padding: "24px" }}>
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))",
              gap: "16px",
              marginBottom: "20px",
            }}
          >
            <div>
              <span
                style={{
                  display: "block",
                  fontSize: "12px",
                  fontWeight: 600,
                  color: "var(--color-text-secondary)",
                  marginBottom: "4px",
                  textTransform: "uppercase",
                  letterSpacing: "0.5px",
                }}
              >
                Category
              </span>
              <div
                style={{
                  backgroundColor: "var(--color-read-only-bg)",
                  border: "1px solid var(--color-input-border)",
                  borderRadius: "6px",
                  padding: "8px 12px",
                  fontSize: "14px",
                  fontWeight: 500,
                  color: "var(--color-text-primary)",
                }}
                data-testid="detail-category"
              >
                {ticket.category.name}
              </div>
            </div>

            <div>
              <span
                style={{
                  display: "block",
                  fontSize: "12px",
                  fontWeight: 600,
                  color: "var(--color-text-secondary)",
                  marginBottom: "4px",
                  textTransform: "uppercase",
                  letterSpacing: "0.5px",
                }}
              >
                Related System
              </span>
              <div
                style={{
                  backgroundColor: "var(--color-read-only-bg)",
                  border: "1px solid var(--color-input-border)",
                  borderRadius: "6px",
                  padding: "8px 12px",
                  fontSize: "14px",
                  fontWeight: 500,
                  color: "var(--color-text-primary)",
                }}
                data-testid="detail-related-system"
              >
                {ticket.relatedSystem.name}
              </div>
            </div>
          </div>

          {/* Summary */}
          <div style={{ marginBottom: "20px" }}>
            <span
              style={{
                display: "block",
                fontSize: "12px",
                fontWeight: 600,
                color: "var(--color-text-secondary)",
                marginBottom: "4px",
                textTransform: "uppercase",
                letterSpacing: "0.5px",
              }}
            >
              Summary
            </span>
            <div
              style={{
                backgroundColor: "var(--color-read-only-bg)",
                border: "1px solid var(--color-input-border)",
                borderRadius: "6px",
                padding: "10px 14px",
                fontSize: "14px",
                fontWeight: 600,
                color: "var(--color-text-primary)",
              }}
              data-testid="detail-summary"
            >
              {ticket.summary}
            </div>
          </div>

          {/* Detailed Description */}
          <div style={{ marginBottom: "28px" }}>
            <span
              style={{
                display: "block",
                fontSize: "12px",
                fontWeight: 600,
                color: "var(--color-text-secondary)",
                marginBottom: "4px",
                textTransform: "uppercase",
                letterSpacing: "0.5px",
              }}
            >
              Description
            </span>
            <div
              style={{
                backgroundColor: "var(--color-read-only-bg)",
                border: "1px solid var(--color-input-border)",
                borderRadius: "6px",
                padding: "14px",
                fontSize: "14px",
                color: "var(--color-text-primary)",
                whiteSpace: "pre-wrap",
                lineHeight: "1.6",
                minHeight: "100px",
              }}
              data-testid="detail-description"
            >
              {ticket.description}
            </div>
          </div>

          {/* Attachments Section */}
          <div style={{ borderTop: "1px solid var(--color-border)", paddingTop: "24px" }}>
            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
                flexWrap: "wrap",
                gap: "12px",
                marginBottom: "16px",
              }}
            >
              <div>
                <h2
                  style={{
                    fontSize: "18px",
                    fontWeight: 700,
                    color: "var(--color-text-primary)",
                    margin: 0,
                  }}
                >
                  Attachments
                </h2>
                <span style={{ fontSize: "13px", color: "var(--color-text-secondary)" }}>
                  {activeCount} of 5 active attachments
                </span>
              </div>

              {canUploadMore ? (
                <div>
                  <input
                    type="file"
                    ref={fileInputRef}
                    style={{ display: "none" }}
                    accept=".jpg,.jpeg,.png,.webp,.pdf,image/jpeg,image/png,image/webp,application/pdf"
                    onChange={handleFileSelected}
                    data-testid="input-additional-attachment"
                  />
                  <button
                    type="button"
                    disabled={isUploading}
                    onClick={() => fileInputRef.current?.click()}
                    style={{
                      padding: "8px 14px",
                      backgroundColor: "var(--color-primary)",
                      color: "white",
                      border: "none",
                      borderRadius: "6px",
                      fontWeight: 600,
                      fontSize: "13px",
                      cursor: isUploading ? "not-allowed" : "pointer",
                      opacity: isUploading ? 0.7 : 1,
                      display: "inline-flex",
                      alignItems: "center",
                      gap: "6px",
                    }}
                    data-testid="btn-add-attachment"
                  >
                    {isUploading ? "Uploading..." : "+ Add Attachment"}
                  </button>
                </div>
              ) : (
                <span
                  style={{
                    fontSize: "12px",
                    color: "var(--color-warning-text)",
                    backgroundColor: "var(--color-warning-bg)",
                    padding: "4px 10px",
                    borderRadius: "6px",
                    fontWeight: 600,
                  }}
                  data-testid="attachment-limit-notice"
                >
                  Attachment limit reached (5/5)
                </span>
              )}
            </div>

            {uploadError && (
              <div
                style={{
                  backgroundColor: "#FEE2E2",
                  color: "#991B1B",
                  border: "1px solid #FCA5A5",
                  borderRadius: "6px",
                  padding: "10px 14px",
                  fontSize: "13px",
                  marginBottom: "16px",
                }}
                data-testid="upload-error-callout"
              >
                {uploadError}
              </div>
            )}

            {/* Attachments List */}
            {ticket.attachments.length === 0 ? (
              <div
                style={{
                  backgroundColor: "#FAFCFA",
                  border: "1px dashed var(--color-border)",
                  borderRadius: "8px",
                  padding: "24px",
                  textAlign: "center",
                  color: "var(--color-text-secondary)",
                  fontSize: "14px",
                }}
                data-testid="no-attachments-msg"
              >
                No attachments uploaded for this ticket.
              </div>
            ) : (
              <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
                {ticket.attachments.map((att) => {
                  if (att.isRemoved) {
                    // Soft-Removed Card
                    return (
                      <div
                        key={att.id}
                        style={{
                          backgroundColor: "#F8FAFC",
                          border: "1px dashed #CBD5E1",
                          borderRadius: "8px",
                          padding: "14px 16px",
                          display: "flex",
                          justifyContent: "space-between",
                          alignItems: "center",
                          flexWrap: "wrap",
                          gap: "12px",
                          opacity: 0.85,
                        }}
                        data-testid={`attachment-removed-${att.id}`}
                      >
                        <div style={{ flex: 1, minWidth: "200px" }}>
                          <div style={{ display: "flex", alignItems: "center", gap: "8px", marginBottom: "4px" }}>
                            <span style={{ fontSize: "16px" }}>📄</span>
                            <span
                              style={{
                                fontWeight: 600,
                                fontSize: "14px",
                                textDecoration: "line-through",
                                color: "#64748B",
                              }}
                            >
                              {att.originalName}
                            </span>
                            <span
                              style={{
                                backgroundColor: "#FEE2E2",
                                color: "#DC2626",
                                padding: "2px 8px",
                                borderRadius: "4px",
                                fontSize: "11px",
                                fontWeight: 700,
                              }}
                            >
                              Removed
                            </span>
                          </div>

                          <div style={{ fontSize: "12px", color: "#64748B", marginTop: "2px" }}>
                            {formatFileSize(att.fileSize)} • Uploaded {formatDate(att.createdAt)}
                          </div>

                          {att.removalReason && (
                            <div
                              style={{
                                marginTop: "8px",
                                padding: "6px 10px",
                                backgroundColor: "#FEF2F2",
                                borderLeft: "3px solid #DC2626",
                                borderRadius: "0 4px 4px 0",
                                fontSize: "12.5px",
                                color: "#7F1D1D",
                              }}
                            >
                              <strong>Reason for removal:</strong> {att.removalReason}
                              {att.removedAt && (
                                <span style={{ marginLeft: "8px", color: "#991B1B", fontSize: "11.5px" }}>
                                  ({formatDate(att.removedAt)})
                                </span>
                              )}
                            </div>
                          )}
                        </div>

                        <div style={{ fontSize: "12px", color: "#94A3B8", fontStyle: "italic" }}>
                          Download unavailable
                        </div>
                      </div>
                    );
                  }

                  // Active Card
                  const downloadUrl = selectedRequester
                    ? getAttachmentDownloadUrl(ticket.id, att.id, selectedRequester.id)
                    : "#";

                  return (
                    <div
                      key={att.id}
                      style={{
                        backgroundColor: "#FFFFFF",
                        border: "1px solid var(--color-border)",
                        borderRadius: "8px",
                        padding: "14px 16px",
                        display: "flex",
                        justifyContent: "space-between",
                        alignItems: "center",
                        flexWrap: "wrap",
                        gap: "12px",
                        boxShadow: "0 1px 2px rgba(0,0,0,0.02)",
                      }}
                      data-testid={`attachment-active-${att.id}`}
                    >
                      <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
                        <span style={{ fontSize: "20px" }}>
                          {att.mimeType.includes("pdf") ? "📕" : "🖼️"}
                        </span>
                        <div>
                          <div
                            style={{
                              fontWeight: 600,
                              fontSize: "14px",
                              color: "var(--color-text-primary)",
                            }}
                          >
                            {att.originalName}
                          </div>
                          <div style={{ fontSize: "12px", color: "var(--color-text-secondary)" }}>
                            {formatFileSize(att.fileSize)} • Uploaded {formatDate(att.createdAt)}
                          </div>
                        </div>
                      </div>

                      <div style={{ display: "flex", gap: "8px", alignItems: "center" }}>
                        <a
                          href={downloadUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          download={att.originalName}
                          style={{
                            padding: "6px 12px",
                            backgroundColor: "var(--color-pale-green)",
                            color: "var(--color-primary)",
                            borderRadius: "6px",
                            fontSize: "13px",
                            fontWeight: 600,
                            textDecoration: "none",
                            display: "inline-flex",
                            alignItems: "center",
                            gap: "4px",
                            border: "1px solid #C6E7D2",
                          }}
                          data-testid={`btn-download-${att.id}`}
                        >
                          ⬇ Download
                        </a>

                        <button
                          type="button"
                          onClick={() => handleOpenRemovalModal(att)}
                          style={{
                            padding: "6px 12px",
                            backgroundColor: "transparent",
                            color: "var(--color-error)",
                            borderRadius: "6px",
                            fontSize: "13px",
                            fontWeight: 600,
                            border: "1px solid #FECACA",
                            cursor: "pointer",
                          }}
                          data-testid={`btn-remove-${att.id}`}
                        >
                          ✕ Remove
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Soft-Removal Reason Modal (UI-06 / AC-07, AC-08) */}
      {targetAttachment && (
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
          data-testid="soft-remove-modal"
        >
          <div
            style={{
              backgroundColor: "white",
              borderRadius: "12px",
              padding: "24px",
              maxWidth: "480px",
              width: "100%",
              boxShadow: "0 10px 25px rgba(0,0,0,0.2)",
            }}
          >
            <h3
              style={{
                fontSize: "18px",
                fontWeight: 700,
                color: "var(--color-text-primary)",
                marginBottom: "8px",
              }}
            >
              Remove Attachment
            </h3>

            <p style={{ fontSize: "14px", color: "var(--color-text-secondary)", marginBottom: "16px" }}>
              Are you sure you want to remove <strong>"{targetAttachment.originalName}"</strong>? This
              file will be marked as removed and future downloads will be permanently blocked.
            </p>

            <div style={{ marginBottom: "16px" }}>
              <label
                htmlFor="removal-reason-input"
                style={{
                  display: "block",
                  fontSize: "13px",
                  fontWeight: 600,
                  color: "var(--color-text-primary)",
                  marginBottom: "6px",
                }}
              >
                Reason for removal (required, min 3 characters) <span style={{ color: "var(--color-error)" }}>*</span>
              </label>
              <textarea
                id="removal-reason-input"
                value={removalReason}
                onChange={(e) => {
                  setRemovalReason(e.target.value);
                  if (removalError) setRemovalError(null);
                }}
                placeholder="e.g. Uploaded obsolete log, incorrect file version, etc."
                rows={3}
                style={{
                  width: "100%",
                  padding: "10px",
                  borderRadius: "6px",
                  border: removalError ? "1px solid var(--color-error)" : "1px solid var(--color-input-border)",
                  fontSize: "14px",
                  fontFamily: "inherit",
                  resize: "vertical",
                }}
                data-testid="removal-reason-textarea"
              />
              <div
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  fontSize: "12px",
                  color: "var(--color-text-secondary)",
                  marginTop: "4px",
                }}
              >
                <span>{removalReason.trim().length} / 3 min characters</span>
              </div>
            </div>

            {removalError && (
              <div
                style={{
                  backgroundColor: "#FEE2E2",
                  color: "#991B1B",
                  padding: "8px 12px",
                  borderRadius: "6px",
                  fontSize: "13px",
                  marginBottom: "16px",
                }}
                data-testid="modal-removal-error"
              >
                {removalError}
              </div>
            )}

            <div style={{ display: "flex", justifyContent: "flex-end", gap: "10px" }}>
              <button
                type="button"
                disabled={isRemoving}
                onClick={handleCloseRemovalModal}
                style={{
                  padding: "8px 16px",
                  backgroundColor: "#F1F5F9",
                  color: "var(--color-text-secondary)",
                  border: "none",
                  borderRadius: "6px",
                  fontWeight: 600,
                  fontSize: "13px",
                  cursor: isRemoving ? "not-allowed" : "pointer",
                }}
                data-testid="btn-cancel-removal"
              >
                Cancel
              </button>

              <button
                type="button"
                disabled={isRemoving || removalReason.trim().length < 3}
                onClick={handleConfirmRemoval}
                style={{
                  padding: "8px 16px",
                  backgroundColor: "var(--color-error)",
                  color: "white",
                  border: "none",
                  borderRadius: "6px",
                  fontWeight: 600,
                  fontSize: "13px",
                  cursor: isRemoving || removalReason.trim().length < 3 ? "not-allowed" : "pointer",
                  opacity: isRemoving || removalReason.trim().length < 3 ? 0.6 : 1,
                  display: "inline-flex",
                  alignItems: "center",
                  gap: "6px",
                }}
                data-testid="btn-confirm-removal"
              >
                {isRemoving ? "Removing..." : "Confirm Removal"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
