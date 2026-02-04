-- CreateEnum
CREATE TYPE "MealPlanGenerationJobStatus" AS ENUM ('PENDING', 'RUNNING', 'DONE', 'FAILED');

-- CreateTable
CREATE TABLE "MealPlanGenerationJob" (
    "id" TEXT NOT NULL,
    "familyId" TEXT NOT NULL,
    "userId" TEXT,
    "daysCount" INTEGER NOT NULL,
    "status" "MealPlanGenerationJobStatus" NOT NULL DEFAULT 'PENDING',
    "error" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "startedAt" TIMESTAMP(3),
    "finishedAt" TIMESTAMP(3),

    CONSTRAINT "MealPlanGenerationJob_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "MealPlanGenerationJob_familyId_createdAt_idx" ON "MealPlanGenerationJob"("familyId", "createdAt");

-- CreateIndex
CREATE INDEX "MealPlanGenerationJob_status_createdAt_idx" ON "MealPlanGenerationJob"("status", "createdAt");

-- AddForeignKey
ALTER TABLE "MealPlanGenerationJob" ADD CONSTRAINT "MealPlanGenerationJob_familyId_fkey" FOREIGN KEY ("familyId") REFERENCES "Family"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MealPlanGenerationJob" ADD CONSTRAINT "MealPlanGenerationJob_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
