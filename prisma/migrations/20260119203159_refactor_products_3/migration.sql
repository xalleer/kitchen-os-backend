/*
  Warnings:

  - You are about to drop the column `atbCategory` on the `Product` table. All the data in the column will be lost.
  - You are about to drop the column `createdAt` on the `Product` table. All the data in the column will be lost.
  - You are about to drop the column `isActive` on the `Product` table. All the data in the column will be lost.
  - You are about to drop the column `keywords` on the `Product` table. All the data in the column will be lost.
  - You are about to drop the column `normalizedName` on the `Product` table. All the data in the column will be lost.
  - You are about to drop the column `price` on the `Product` table. All the data in the column will be lost.
  - You are about to drop the column `priceUpdatedAt` on the `Product` table. All the data in the column will be lost.
  - You are about to drop the column `title` on the `Product` table. All the data in the column will be lost.
  - You are about to drop the column `updatedAt` on the `Product` table. All the data in the column will be lost.
  - A unique constraint covering the columns `[name]` on the table `Product` will be added. If there are existing duplicate values, this will fail.
  - Added the required column `name` to the `Product` table without a default value. This is not possible if the table is not empty.

*/
-- DropIndex
DROP INDEX "Product_atbCategory_idx";

-- DropIndex
DROP INDEX "Product_isActive_idx";

-- DropIndex
DROP INDEX "Product_normalizedName_idx";

-- DropIndex
DROP INDEX "Product_price_idx";

-- DropIndex
DROP INDEX "Product_title_key";

-- AlterTable
ALTER TABLE "Product" DROP COLUMN "atbCategory",
DROP COLUMN "createdAt",
DROP COLUMN "isActive",
DROP COLUMN "keywords",
DROP COLUMN "normalizedName",
DROP COLUMN "price",
DROP COLUMN "priceUpdatedAt",
DROP COLUMN "title",
DROP COLUMN "updatedAt",
ADD COLUMN     "category" TEXT,
ADD COLUMN     "familyMemberId" TEXT,
ADD COLUMN     "name" TEXT NOT NULL;

-- CreateIndex
CREATE UNIQUE INDEX "Product_name_key" ON "Product"("name");

-- AddForeignKey
ALTER TABLE "Product" ADD CONSTRAINT "Product_familyMemberId_fkey" FOREIGN KEY ("familyMemberId") REFERENCES "FamilyMember"("id") ON DELETE SET NULL ON UPDATE CASCADE;
