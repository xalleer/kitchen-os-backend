/*
  Warnings:

  - You are about to drop the column `familyMemberId` on the `Product` table. All the data in the column will be lost.

*/
-- DropForeignKey
ALTER TABLE "Product" DROP CONSTRAINT "Product_familyMemberId_fkey";

-- AlterTable
ALTER TABLE "Product" DROP COLUMN "familyMemberId";
