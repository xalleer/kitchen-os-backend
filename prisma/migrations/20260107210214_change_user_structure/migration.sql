/*
  Warnings:

  - You are about to drop the column `role` on the `User` table. All the data in the column will be lost.

*/
-- CreateEnum
CREATE TYPE "Gender" AS ENUM ('MALE', 'FEMALE', 'UNSPECIFIED');

-- AlterTable
ALTER TABLE "User" DROP COLUMN "role";

-- CreateTable
CREATE TABLE "FamilyMember" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "familyId" TEXT NOT NULL,
    "userId" TEXT,
    "gender" "Gender" NOT NULL DEFAULT 'UNSPECIFIED',
    "weight" DOUBLE PRECISION,
    "height" DOUBLE PRECISION,
    "age" INTEGER,
    "goal" "Goal" NOT NULL DEFAULT 'MAINTAIN',
    "allergies" TEXT[],
    "dislikedProducts" TEXT[],
    "eatsBreakfast" BOOLEAN NOT NULL DEFAULT true,
    "eatsLunch" BOOLEAN NOT NULL DEFAULT true,
    "eatsDinner" BOOLEAN NOT NULL DEFAULT true,
    "eatsSnack" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "FamilyMember_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "FamilyMember_userId_key" ON "FamilyMember"("userId");

-- AddForeignKey
ALTER TABLE "FamilyMember" ADD CONSTRAINT "FamilyMember_familyId_fkey" FOREIGN KEY ("familyId") REFERENCES "Family"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FamilyMember" ADD CONSTRAINT "FamilyMember_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
