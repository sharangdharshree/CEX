/*
  Warnings:

  - Added the required column `revokedAt` to the `Sessions` table without a default value. This is not possible if the table is not empty.

*/
-- DropIndex
DROP INDEX "Sessions_refreshToken_key";

-- AlterTable
ALTER TABLE "Sessions" ADD COLUMN     "revokedAt" TIMESTAMP(3) NOT NULL;

-- CreateIndex
CREATE INDEX "Sessions_username_idx" ON "Sessions"("username");

-- CreateIndex
CREATE INDEX "Stocks_symbol_idx" ON "Stocks"("symbol");

-- CreateIndex
CREATE INDEX "Users_email_idx" ON "Users"("email");

-- CreateIndex
CREATE INDEX "Users_username_idx" ON "Users"("username");
