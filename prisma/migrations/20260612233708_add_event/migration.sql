-- CreateEnum
CREATE TYPE "EventType" AS ENUM ('SOW', 'GERMINATE', 'TRANSPLANT', 'HARVEST', 'DEATH', 'NOTE');

-- CreateTable
CREATE TABLE "Event" (
    "id" TEXT NOT NULL,
    "plantId" TEXT NOT NULL,
    "workspaceId" TEXT NOT NULL,
    "type" "EventType" NOT NULL,
    "occurredAt" TIMESTAMP(3) NOT NULL,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Event_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "Event_plantId_occurredAt_idx" ON "Event"("plantId", "occurredAt");

-- CreateIndex
CREATE INDEX "Event_workspaceId_idx" ON "Event"("workspaceId");

-- AddForeignKey
ALTER TABLE "Event" ADD CONSTRAINT "Event_plantId_fkey" FOREIGN KEY ("plantId") REFERENCES "Plant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Event" ADD CONSTRAINT "Event_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id") ON DELETE CASCADE ON UPDATE CASCADE;
