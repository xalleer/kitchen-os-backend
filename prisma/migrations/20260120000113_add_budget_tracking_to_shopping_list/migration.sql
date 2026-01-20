/*
  Warnings:

  - Added the required column `updatedAt` to the `ShoppingListItem` table without a default value. This is not possible if the table is not empty.

*/
-- AlterTable
ALTER TABLE "ShoppingListItem" ADD COLUMN     "actualPrice" DOUBLE PRECISION,
ADD COLUMN     "boughtAt" TIMESTAMP(3),
ADD COLUMN     "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
ADD COLUMN     "estimatedPrice" DOUBLE PRECISION,
ADD COLUMN     "updatedAt" TIMESTAMP(3) NOT NULL;
