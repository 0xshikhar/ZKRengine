-- CreateTable
CREATE TABLE "Request" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "requestId" TEXT NOT NULL,
    "chainId" INTEGER NOT NULL,
    "seed" TEXT NOT NULL,
    "requester" TEXT NOT NULL,
    "callbackAddress" TEXT,
    "status" TEXT NOT NULL DEFAULT 'pending',
    "feePaid" TEXT,
    "randomValue" TEXT,
    "proofHash" TEXT,
    "requestedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "fulfilledAt" DATETIME,
    "expiresAt" DATETIME NOT NULL,
    "processingTime" INTEGER,
    "error" TEXT,
    "metadata" TEXT
);

-- CreateTable
CREATE TABLE "Proof" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "requestId" TEXT NOT NULL,
    "chainId" INTEGER NOT NULL,
    "proofData" TEXT NOT NULL,
    "generationTime" INTEGER,
    "verificationKeyHash" TEXT NOT NULL,
    "proofHash" TEXT,
    "randomValue" TEXT,
    "verificationStatus" TEXT NOT NULL DEFAULT 'pending',
    "zkVerifyStatus" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "Proof_requestId_fkey" FOREIGN KEY ("requestId") REFERENCES "Request" ("requestId") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "Chain" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "chainId" INTEGER NOT NULL,
    "name" TEXT NOT NULL,
    "rpcUrl" TEXT NOT NULL,
    "currency" TEXT NOT NULL,
    "blockTime" INTEGER NOT NULL,
    "confirmations" INTEGER NOT NULL,
    "healthy" BOOLEAN NOT NULL DEFAULT true,
    "lastBlockNumber" INTEGER,
    "lastUpdate" DATETIME,
    "totalRequests" INTEGER NOT NULL DEFAULT 0,
    "fulfilledRequests" INTEGER NOT NULL DEFAULT 0,
    "failedRequests" INTEGER NOT NULL DEFAULT 0,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- CreateIndex
CREATE UNIQUE INDEX "Request_requestId_key" ON "Request"("requestId");

-- CreateIndex
CREATE INDEX "Request_requester_idx" ON "Request"("requester");

-- CreateIndex
CREATE INDEX "Request_chainId_idx" ON "Request"("chainId");

-- CreateIndex
CREATE INDEX "Request_status_idx" ON "Request"("status");

-- CreateIndex
CREATE INDEX "Request_requestedAt_idx" ON "Request"("requestedAt");

-- CreateIndex
CREATE UNIQUE INDEX "Proof_requestId_key" ON "Proof"("requestId");

-- CreateIndex
CREATE INDEX "Proof_chainId_idx" ON "Proof"("chainId");

-- CreateIndex
CREATE INDEX "Proof_verificationStatus_idx" ON "Proof"("verificationStatus");

-- CreateIndex
CREATE INDEX "Proof_createdAt_idx" ON "Proof"("createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "Chain_chainId_key" ON "Chain"("chainId");

-- CreateIndex
CREATE INDEX "Chain_chainId_idx" ON "Chain"("chainId");

-- CreateIndex
CREATE INDEX "Chain_healthy_idx" ON "Chain"("healthy");
