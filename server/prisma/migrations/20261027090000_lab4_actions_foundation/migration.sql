BEGIN;
-- CreateEnum
CREATE TYPE "ActionStatus" AS ENUM ('PLANNED', 'IN_PROGRESS', 'COMPLETED', 'CANCELLED');

-- AlterTable
ALTER TABLE "Ticket" ADD COLUMN     "resolvedAt" TIMESTAMPTZ(3),
ADD COLUMN     "resolvedAtEstimated" BOOLEAN NOT NULL DEFAULT false;

-- CreateTable
CREATE TABLE "ActionTaken" (
    "id" SERIAL NOT NULL,
    "ticketId" INTEGER NOT NULL,
    "performedById" INTEGER NOT NULL,
    "assigneeId" INTEGER NOT NULL,
    "actionAt" TIMESTAMPTZ(3) NOT NULL,
    "description" VARCHAR(2000) NOT NULL,
    "result" TEXT,
    "followUpRequired" BOOLEAN NOT NULL,
    "followUpNote" TEXT,
    "followUpCompletedAt" TIMESTAMPTZ(3),
    "followUpCompletedById" INTEGER,
    "followUpCompletionNote" TEXT,
    "attachmentNotes" TEXT,
    "status" "ActionStatus" NOT NULL,
    "version" INTEGER NOT NULL DEFAULT 0,
    "clientRequestId" UUID NOT NULL,
    "canonicalRequest" TEXT NOT NULL,
    "seedKey" TEXT,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "ActionTaken_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ActionTakenRevision" (
    "id" SERIAL NOT NULL,
    "actionId" INTEGER NOT NULL,
    "version" INTEGER NOT NULL,
    "editorId" INTEGER NOT NULL,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "snapshot" JSONB NOT NULL,

    CONSTRAINT "ActionTakenRevision_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TicketStatusEvent" (
    "id" SERIAL NOT NULL,
    "ticketId" INTEGER NOT NULL,
    "actorId" INTEGER NOT NULL,
    "fromStatus" "TicketStatus" NOT NULL,
    "toStatus" "TicketStatus" NOT NULL,
    "ticketVersion" INTEGER NOT NULL,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "TicketStatusEvent_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "LabMetadata" (
    "key" TEXT NOT NULL,
    "recordedAt" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "LabMetadata_pkey" PRIMARY KEY ("key")
);

-- CreateIndex
CREATE UNIQUE INDEX "ActionTaken_seedKey_key" ON "ActionTaken"("seedKey");

-- CreateIndex
CREATE INDEX "ActionTaken_ticketId_createdAt_id_idx" ON "ActionTaken"("ticketId", "createdAt", "id");

-- CreateIndex
CREATE INDEX "ActionTaken_assigneeId_status_updatedAt_id_idx" ON "ActionTaken"("assigneeId", "status", "updatedAt", "id");

-- CreateIndex
CREATE UNIQUE INDEX "ActionTaken_performedById_clientRequestId_key" ON "ActionTaken"("performedById", "clientRequestId");

-- CreateIndex
CREATE UNIQUE INDEX "ActionTakenRevision_actionId_version_key" ON "ActionTakenRevision"("actionId", "version");

-- CreateIndex
CREATE INDEX "TicketStatusEvent_ticketId_createdAt_id_idx" ON "TicketStatusEvent"("ticketId", "createdAt", "id");

-- CreateIndex
CREATE UNIQUE INDEX "TicketStatusEvent_ticketId_ticketVersion_key" ON "TicketStatusEvent"("ticketId", "ticketVersion");

-- CreateIndex
CREATE INDEX "Ticket_requesterId_status_resolvedAt_idx" ON "Ticket"("requesterId", "status", "resolvedAt");

-- CreateIndex
CREATE INDEX "Ticket_status_resolvedAt_idx" ON "Ticket"("status", "resolvedAt");

-- AddForeignKey
ALTER TABLE "ActionTaken" ADD CONSTRAINT "ActionTaken_ticketId_fkey" FOREIGN KEY ("ticketId") REFERENCES "Ticket"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ActionTaken" ADD CONSTRAINT "ActionTaken_performedById_fkey" FOREIGN KEY ("performedById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ActionTaken" ADD CONSTRAINT "ActionTaken_assigneeId_fkey" FOREIGN KEY ("assigneeId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ActionTaken" ADD CONSTRAINT "ActionTaken_followUpCompletedById_fkey" FOREIGN KEY ("followUpCompletedById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ActionTakenRevision" ADD CONSTRAINT "ActionTakenRevision_actionId_fkey" FOREIGN KEY ("actionId") REFERENCES "ActionTaken"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ActionTakenRevision" ADD CONSTRAINT "ActionTakenRevision_editorId_fkey" FOREIGN KEY ("editorId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TicketStatusEvent" ADD CONSTRAINT "TicketStatusEvent_ticketId_fkey" FOREIGN KEY ("ticketId") REFERENCES "Ticket"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TicketStatusEvent" ADD CONSTRAINT "TicketStatusEvent_actorId_fkey" FOREIGN KEY ("actorId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;


-- Existing timestamps are timezone-less UTC; do not rewrite legacy audit fields.
UPDATE "Ticket" SET "resolvedAt" = "updatedAt" AT TIME ZONE 'UTC', "resolvedAtEstimated" = true
WHERE status IN ('RESOLVED', 'CLOSED');
INSERT INTO "LabMetadata" (key, "recordedAt") VALUES ('lab4-history-start', CURRENT_TIMESTAMP);

ALTER TABLE "ActionTaken" ADD CONSTRAINT "ActionTaken_follow_up_completion_check" CHECK (
  ("followUpCompletedAt" IS NULL AND "followUpCompletedById" IS NULL AND "followUpCompletionNote" IS NULL)
  OR ("followUpCompletedAt" IS NOT NULL AND "followUpCompletedById" IS NOT NULL
      AND "followUpCompletionNote" IS NOT NULL AND length(btrim("followUpCompletionNote")) > 0
      AND "followUpRequired" = false AND status = 'COMPLETED')
);
-- Histories can be appended but never rewritten through application SQL.
CREATE FUNCTION reject_lab4_history_mutation() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  RAISE EXCEPTION 'Lab 4 history is append-only';
END;
$$;
CREATE TRIGGER "ActionTakenRevision_immutable" BEFORE UPDATE OR DELETE ON "ActionTakenRevision"
FOR EACH ROW EXECUTE FUNCTION reject_lab4_history_mutation();
CREATE TRIGGER "TicketStatusEvent_immutable" BEFORE UPDATE OR DELETE ON "TicketStatusEvent"
FOR EACH ROW EXECUTE FUNCTION reject_lab4_history_mutation();
COMMIT;
