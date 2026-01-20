-- AlterTable
ALTER TABLE "InventoryItem" ADD COLUMN     "deductFromBudget" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "purchasePrice" DOUBLE PRECISION;

-- AlterTable
ALTER TABLE "MealPlan" ADD COLUMN     "cookedAt" TIMESTAMP(3),
ADD COLUMN     "isCooked" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "isSkipped" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "skippedAt" TIMESTAMP(3);

-- AlterTable
ALTER TABLE "UserPreference" ADD COLUMN     "breakfastTime" TEXT,
ADD COLUMN     "dinnerTime" TEXT,
ADD COLUMN     "lunchTime" TEXT,
ADD COLUMN     "notificationsEnabled" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "snackTime" TEXT;

-- CreateTable
CREATE TABLE "FamilyInvite" (
    "id" TEXT NOT NULL,
    "familyId" TEXT NOT NULL,
    "familyMemberId" TEXT NOT NULL,
    "inviteCode" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3),
    "usedAt" TIMESTAMP(3),
    "usedByUserId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "FamilyInvite_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "WeeklyMealPlan" (
    "id" TEXT NOT NULL,
    "familyId" TEXT NOT NULL,
    "startDate" TIMESTAMP(3) NOT NULL,
    "endDate" TIMESTAMP(3) NOT NULL,
    "isConfirmed" BOOLEAN NOT NULL DEFAULT false,
    "confirmedAt" TIMESTAMP(3),
    "estimatedCost" DECIMAL(65,30) NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "WeeklyMealPlan_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "WeeklyBudget" (
    "id" TEXT NOT NULL,
    "familyId" TEXT NOT NULL,
    "weekStartDate" TIMESTAMP(3) NOT NULL,
    "weekEndDate" TIMESTAMP(3) NOT NULL,
    "totalBudget" DECIMAL(65,30) NOT NULL,
    "spent" DECIMAL(65,30) NOT NULL DEFAULT 0,
    "remaining" DECIMAL(65,30) NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "WeeklyBudget_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "FamilyInvite_familyMemberId_key" ON "FamilyInvite"("familyMemberId");

-- CreateIndex
CREATE UNIQUE INDEX "FamilyInvite_inviteCode_key" ON "FamilyInvite"("inviteCode");

-- CreateIndex
CREATE INDEX "FamilyInvite_inviteCode_idx" ON "FamilyInvite"("inviteCode");

-- CreateIndex
CREATE INDEX "FamilyInvite_familyMemberId_idx" ON "FamilyInvite"("familyMemberId");

-- CreateIndex
CREATE INDEX "WeeklyMealPlan_familyId_isConfirmed_idx" ON "WeeklyMealPlan"("familyId", "isConfirmed");

-- CreateIndex
CREATE UNIQUE INDEX "WeeklyMealPlan_familyId_startDate_key" ON "WeeklyMealPlan"("familyId", "startDate");

-- CreateIndex
CREATE INDEX "WeeklyBudget_familyId_weekStartDate_idx" ON "WeeklyBudget"("familyId", "weekStartDate");

-- CreateIndex
CREATE UNIQUE INDEX "WeeklyBudget_familyId_weekStartDate_key" ON "WeeklyBudget"("familyId", "weekStartDate");

-- AddForeignKey
ALTER TABLE "FamilyInvite" ADD CONSTRAINT "FamilyInvite_familyId_fkey" FOREIGN KEY ("familyId") REFERENCES "Family"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FamilyInvite" ADD CONSTRAINT "FamilyInvite_familyMemberId_fkey" FOREIGN KEY ("familyMemberId") REFERENCES "FamilyMember"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WeeklyMealPlan" ADD CONSTRAINT "WeeklyMealPlan_familyId_fkey" FOREIGN KEY ("familyId") REFERENCES "Family"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WeeklyBudget" ADD CONSTRAINT "WeeklyBudget_familyId_fkey" FOREIGN KEY ("familyId") REFERENCES "Family"("id") ON DELETE CASCADE ON UPDATE CASCADE;
