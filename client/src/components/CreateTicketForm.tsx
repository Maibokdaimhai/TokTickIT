import React, { useState, useEffect } from "react";
import { useRequester } from "../context/RequesterContext.js";
import { fetchCategories, fetchRelatedSystems, createTicket, deleteTicketRollback, uploadAttachment } from "../api.js";
import { Category, RelatedSystem, Priority, Ticket } from "../types.js";

interface CreateTicketFormProps {
  onTicketCreated?: (ticket: Ticket) => void;
}

export const CreateTicketForm: React.FC<CreateTicketFormProps> = ({ onTicketCreated }) => {
  const { selectedRequester, openSelector } = useRequester();

  const [categories, setCategories] = useState<Category[]>([]);
  const [relatedSystems, setRelatedSystems] = useState<RelatedSystem[]>([]);

  // Form State
  const [categoryId, setCategoryId] = useState<number | "">("");
  const [relatedSystemId, setRelatedSystemId] = useState<number | "">("");
  const [requestedPriority, setRequestedPriority] = useState<Priority>("MEDIUM");
  const [summary, setSummary] = useState<string>("");
  const [description, setDescription] = useState<string>("");

  // Attachments (Initial upload dropzone for Step 2)
  const [selectedFiles, setSelectedFiles] = useState<File[]>([]);
  const [fileError, setFileError] = useState<string | null>(null);

  // Status & Validation State
  const [loadingRefData, setLoadingRefData] = useState<boolean>(true);
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [apiError, setApiError] = useState<string | null>(null);
  const [createdTicket, setCreatedTicket] = useState<Ticket | null>(null);

  // Fetch reference data (Categories & Related Systems)
  useEffect(() => {
    let mounted = true;
    setLoadingRefData(true);

    Promise.all([fetchCategories(), fetchRelatedSystems()])
      .then(([catData, sysData]) => {
        if (!mounted) return;
        setCategories(catData);
        setRelatedSystems(sysData);

        if (catData.length > 0) setCategoryId(catData[0].id);
        if (sysData.length > 0) setRelatedSystemId(sysData[0].id);

        setLoadingRefData(false);
      })
      .catch((err) => {
        if (!mounted) return;
        setApiError(err.message || "Failed to load reference data");
        setLoadingRefData(false);
      });

    return () => {
      mounted = false;
    };
  }, []);

  // Validate File Selection (BR-06, BR-07, BR-08)
  const handleFileSelection = (e: React.ChangeEvent<HTMLInputElement>) => {
    setFileError(null);
    if (!e.target.files) return;

    const files = Array.from(e.target.files);
    const validMimes = ["image/jpeg", "image/png", "image/webp", "application/pdf"];
    const maxSize = 5 * 1024 * 1024; // 5 MB

    if (selectedFiles.length + files.length > 5) {
      setFileError("Maximum 5 active attachments allowed per ticket.");
      return;
    }

    for (const file of files) {
      if (!validMimes.includes(file.type)) {
        setFileError(`Invalid file format '${file.name}'. Only JPG, PNG, WEBP, and PDF files are permitted.`);
        return;
      }
      if (file.size > maxSize) {
        setFileError(`File '${file.name}' exceeds the 5 MB file size limit.`);
        return;
      }
    }

    setSelectedFiles((prev) => [...prev, ...files]);
  };

  const removeFile = (index: number) => {
    setSelectedFiles((prev) => prev.filter((_, i) => i !== index));
    setFileError(null);
  };

  // Frontend Form Validation (BR-11)
  const validateForm = (): boolean => {
    const errors: Record<string, string> = {};

    const trimmedSummary = summary.trim();
    if (!trimmedSummary) {
      errors.summary = "Summary is required.";
    } else if (trimmedSummary.length < 5 || trimmedSummary.length > 150) {
      errors.summary = "Summary must be between 5 and 150 characters.";
    }

    const trimmedDescription = description.trim();
    if (!trimmedDescription) {
      errors.description = "Description is required.";
    } else if (trimmedDescription.length < 10 || trimmedDescription.length > 3000) {
      errors.description = "Description must be between 10 and 3000 characters.";
    }

    if (!categoryId) {
      errors.category = "Category is required.";
    }

    if (!relatedSystemId) {
      errors.relatedSystem = "Related System is required.";
    }

    if (!requestedPriority) {
      errors.priority = "Requested Priority is required.";
    }

    setFieldErrors(errors);
    return Object.keys(errors).length === 0;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setApiError(null);
    setCreatedTicket(null);

    if (!selectedRequester) {
      openSelector();
      return;
    }

    if (!validateForm()) {
      return;
    }

    setIsSubmitting(true);
    setApiError(null);

    try {
      const payload = {
        requesterId: selectedRequester.id,
        categoryId: Number(categoryId),
        relatedSystemId: Number(relatedSystemId),
        summary: summary.trim(),
        description: description.trim(),
        requestedPriority,
      };

      // Step 1: Create Ticket (BR-16)
      const ticket = await createTicket(payload);

      // Step 2: Upload initial attachments if any (BR-16 / AC-15)
      if (selectedFiles.length > 0) {
        try {
          for (const file of selectedFiles) {
            await uploadAttachment(ticket.id, file, selectedRequester.id);
          }
        } catch (uploadErr: any) {
          // Compensation Rollback: delete draft ticket and remove uploaded files
          try {
            await deleteTicketRollback(ticket.id, selectedRequester.id);
          } catch {
            // Rollback error fallback
          }
          const errorDetail = uploadErr?.message || "Failed to upload one or more attachments.";
          setApiError(`Attachment upload failed: ${errorDetail}. The draft ticket was rolled back.`);
          setIsSubmitting(false);
          return;
        }
      }

      setCreatedTicket(ticket);
      setIsSubmitting(false);

      if (onTicketCreated) {
        onTicketCreated(ticket);
      }
    } catch (err: any) {
      setApiError(err.message || "An unexpected error occurred while creating the ticket.");
      setIsSubmitting(false);
    }
  };

  const resetForm = () => {
    setSummary("");
    setDescription("");
    setSelectedFiles([]);
    setFieldErrors({});
    setApiError(null);
    setCreatedTicket(null);
    if (categories.length > 0) setCategoryId(categories[0].id);
    if (relatedSystems.length > 0) setRelatedSystemId(relatedSystems[0].id);
    setRequestedPriority("MEDIUM");
  };

  const todayStr = new Date().toISOString().split("T")[0];

  return (
    <div style={{ backgroundColor: "white", padding: "24px", borderRadius: "12px", border: "1px solid var(--color-border)" }}>
      <h1 style={{ fontSize: "20px", color: "var(--color-primary)", marginBottom: "8px" }}>
        ➕ Create Support Ticket
      </h1>
      <p style={{ color: "var(--color-text-secondary)", marginBottom: "20px", fontSize: "14px" }}>
        Submit an IT support request to receive a unique Ticket Number and track resolution.
      </p>

      {/* Success Notification */}
      {createdTicket && (
        <div className="form-success-banner" style={{ padding: "16px", backgroundColor: "#DCFCE7", border: "1px solid #86EFAC", borderRadius: "8px", marginBottom: "20px" }}>
          <div style={{ fontSize: "16px", fontWeight: "bold", color: "#166534" }}>
            🎉 Ticket Created Successfully!
          </div>
          <p style={{ margin: "4px 0 12px 0", color: "#15803D" }}>
            Official Ticket Number: <strong>{createdTicket.ticketNumber}</strong> | Initial Status: <strong>{createdTicket.status}</strong>
          </p>
          <button type="button" className="btn-secondary" onClick={resetForm}>
            Submit Another Ticket
          </button>
        </div>
      )}

      {/* Top API Error Callout (Data retention preserved) */}
      {apiError && (
        <div className="form-error-msg" style={{ padding: "12px 16px", backgroundColor: "#FEE2E2", border: "1px solid #FCA5A5", borderRadius: "8px", marginBottom: "20px", color: "#991B1B" }}>
          ⚠️ <strong>Submission Error:</strong> {apiError}
        </div>
      )}

      {/* No Requester Selected Warning */}
      {!selectedRequester && (
        <div style={{ padding: "16px", backgroundColor: "#FEF3C7", border: "1px solid #FDE68A", borderRadius: "8px", marginBottom: "20px" }}>
          ⚠️ <strong>Identity Context Required:</strong> Please select a Development Requester identity before submitting a ticket.
          <button type="button" className="btn-secondary" style={{ marginLeft: "12px" }} onClick={openSelector}>
            Select Requester
          </button>
        </div>
      )}

      <form onSubmit={handleSubmit} noValidate>
        {/* Read-Only Ticket Header Info */}
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: "16px", padding: "16px", backgroundColor: "var(--color-bg)", borderRadius: "8px", marginBottom: "24px" }}>
          <div>
            <span style={{ fontSize: "12px", color: "var(--color-text-secondary)", display: "block" }}>Ticket Number</span>
            <strong style={{ fontSize: "15px", color: "var(--color-primary)" }}>TKT-2026-AUTO (Assigned on Submit)</strong>
          </div>
          <div>
            <span style={{ fontSize: "12px", color: "var(--color-text-secondary)", display: "block" }}>Date Created</span>
            <strong style={{ fontSize: "15px" }}>{todayStr}</strong>
          </div>
          <div>
            <span style={{ fontSize: "12px", color: "var(--color-text-secondary)", display: "block" }}>Requester Identity</span>
            <strong style={{ fontSize: "15px" }}>
              {selectedRequester ? `${selectedRequester.name} (${selectedRequester.department})` : "None Selected"}
            </strong>
          </div>
        </div>

        {/* Categories & Related Systems Grid */}
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(250px, 1fr))", gap: "20px", marginBottom: "20px" }}>
          {/* Category Dropdown */}
          <div className="form-group">
            <label htmlFor="ticket-category" className="form-label">
              IT Category <span className="required-star">*</span>
            </label>
            <select
              id="ticket-category"
              className="form-select"
              value={categoryId}
              onChange={(e) => setCategoryId(Number(e.target.value))}
              disabled={loadingRefData || isSubmitting}
            >
              {categories.map((cat) => (
                <option key={cat.id} value={cat.id}>
                  {cat.name}
                </option>
              ))}
            </select>
            {fieldErrors.category && <div className="field-error">{fieldErrors.category}</div>}
          </div>

          {/* Related System Dropdown */}
          <div className="form-group">
            <label htmlFor="ticket-related-system" className="form-label">
              Related System <span className="required-star">*</span>
            </label>
            <select
              id="ticket-related-system"
              className="form-select"
              value={relatedSystemId}
              onChange={(e) => setRelatedSystemId(Number(e.target.value))}
              disabled={loadingRefData || isSubmitting}
            >
              {relatedSystems.map((sys) => (
                <option key={sys.id} value={sys.id}>
                  {sys.name}
                </option>
              ))}
            </select>
            {fieldErrors.relatedSystem && <div className="field-error">{fieldErrors.relatedSystem}</div>}
          </div>

          {/* Requested Priority Dropdown */}
          <div className="form-group">
            <label htmlFor="ticket-priority" className="form-label">
              Requested Priority <span className="required-star">*</span>
            </label>
            <select
              id="ticket-priority"
              className="form-select"
              value={requestedPriority}
              onChange={(e) => setRequestedPriority(e.target.value as Priority)}
              disabled={isSubmitting}
            >
              <option value="LOW">Low</option>
              <option value="MEDIUM">Medium</option>
              <option value="HIGH">High</option>
              <option value="URGENT">Urgent</option>
            </select>
            {fieldErrors.priority && <div className="field-error">{fieldErrors.priority}</div>}
          </div>
        </div>

        {/* Ticket Summary */}
        <div className="form-group" style={{ marginBottom: "20px" }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <label htmlFor="ticket-summary" className="form-label">
              Summary <span className="required-star">*</span>
            </label>
            <span style={{ fontSize: "12px", color: summary.length > 150 ? "#DC2626" : "var(--color-text-secondary)" }}>
              {summary.length} / 150 chars
            </span>
          </div>
          <input
            type="text"
            id="ticket-summary"
            className="form-control"
            placeholder="Brief title summarizing the IT issue (e.g. Cannot connect to Campus Wi-Fi)"
            value={summary}
            onChange={(e) => setSummary(e.target.value)}
            maxLength={150}
            disabled={isSubmitting}
          />
          {fieldErrors.summary && <div className="field-error" style={{ color: "#DC2626", fontSize: "13px", marginTop: "4px" }}>⚠️ {fieldErrors.summary}</div>}
        </div>

        {/* Ticket Description */}
        <div className="form-group" style={{ marginBottom: "20px" }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <label htmlFor="ticket-description" className="form-label">
              Detailed Description <span className="required-star">*</span>
            </label>
            <span style={{ fontSize: "12px", color: description.length > 3000 ? "#DC2626" : "var(--color-text-secondary)" }}>
              {description.length} / 3000 chars
            </span>
          </div>
          <textarea
            id="ticket-description"
            className="form-control"
            rows={5}
            placeholder="Provide clear details about the issue, error messages, and steps to reproduce..."
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            maxLength={3000}
            disabled={isSubmitting}
          />
          {fieldErrors.description && <div className="field-error" style={{ color: "#DC2626", fontSize: "13px", marginTop: "4px" }}>⚠️ {fieldErrors.description}</div>}
        </div>

        {/* Initial Attachments Dropzone */}
        <div className="form-group" style={{ marginBottom: "24px" }}>
          <label className="form-label">Supporting Evidence Attachments (Optional)</label>
          <div style={{ border: "2px dashed var(--color-border)", padding: "16px", borderRadius: "8px", backgroundColor: "#FAFAFA", textAlign: "center" }}>
            <input
              type="file"
              id="initial-attachments"
              multiple
              accept=".jpg,.jpeg,.png,.webp,.pdf"
              style={{ display: "none" }}
              onChange={handleFileSelection}
              disabled={isSubmitting || selectedFiles.length >= 5}
            />
            <label htmlFor="initial-attachments" style={{ cursor: "pointer", color: "var(--color-primary)", fontWeight: "500" }}>
              📎 Click to Select Attachments
            </label>
            <p style={{ margin: "4px 0 0 0", fontSize: "12px", color: "var(--color-text-secondary)" }}>
              Accepted formats: JPG, PNG, WEBP, PDF (up to 5 MB per file, max 5 files).
            </p>
          </div>

          {fileError && <div style={{ color: "#DC2626", fontSize: "13px", marginTop: "6px" }}>⚠️ {fileError}</div>}

          {/* Selected File List */}
          {selectedFiles.length > 0 && (
            <ul style={{ listStyle: "none", padding: 0, marginTop: "12px" }}>
              {selectedFiles.map((file, i) => (
                <li key={i} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "8px 12px", backgroundColor: "#F1F5F9", borderRadius: "6px", marginBottom: "6px", fontSize: "13px" }}>
                  <span>📄 {file.name} ({(file.size / 1024 / 1024).toFixed(2)} MB)</span>
                  <button type="button" style={{ background: "none", border: "none", color: "#DC2626", cursor: "pointer" }} onClick={() => removeFile(i)}>
                    ❌ Remove
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>

        {/* Submit Actions */}
        <div style={{ display: "flex", justifyContent: "flex-end", gap: "12px" }}>
          <button
            type="button"
            className="btn-secondary"
            onClick={resetForm}
            disabled={isSubmitting}
          >
            Clear Form
          </button>
          <button
            type="submit"
            className="btn-primary"
            disabled={isSubmitting || loadingRefData || !selectedRequester}
          >
            {isSubmitting ? "⏳ Submitting Ticket..." : "Submit Ticket"}
          </button>
        </div>
      </form>
    </div>
  );
};
