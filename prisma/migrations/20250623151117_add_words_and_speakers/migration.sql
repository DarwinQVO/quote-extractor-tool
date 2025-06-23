-- CreateTable
CREATE TABLE "Word" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "transcriptId" TEXT NOT NULL,
    "text" TEXT NOT NULL,
    "start" REAL NOT NULL,
    "end" REAL NOT NULL,
    "speaker" TEXT,
    CONSTRAINT "Word_transcriptId_fkey" FOREIGN KEY ("transcriptId") REFERENCES "Transcript" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "Speaker" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "transcriptId" TEXT NOT NULL,
    "originalName" TEXT NOT NULL,
    "customName" TEXT NOT NULL,
    CONSTRAINT "Speaker_transcriptId_fkey" FOREIGN KEY ("transcriptId") REFERENCES "Transcript" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateIndex
CREATE INDEX "Word_transcriptId_idx" ON "Word"("transcriptId");

-- CreateIndex
CREATE INDEX "Word_start_idx" ON "Word"("start");

-- CreateIndex
CREATE INDEX "Speaker_transcriptId_idx" ON "Speaker"("transcriptId");
