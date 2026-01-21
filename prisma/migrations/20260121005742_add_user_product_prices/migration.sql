/*
  Warnings:

  - You are about to drop the column `price` on the `Product` table. All the data in the column will be lost.

*/
-- AlterTable
ALTER TABLE "Product" DROP COLUMN "price",
ADD COLUMN     "averagePrice" DOUBLE PRECISION NOT NULL DEFAULT 0,
ADD COLUMN     "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
ADD COLUMN     "lastPrice" DOUBLE PRECISION,
ADD COLUMN     "maxPrice" DOUBLE PRECISION,
ADD COLUMN     "minPrice" DOUBLE PRECISION,
ADD COLUMN     "priceSamplesCount" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "priceUpdatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
ADD COLUMN     "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;

-- CreateTable
CREATE TABLE "UserProductPrice" (
    "id" TEXT NOT NULL,
    "productId" TEXT NOT NULL,
    "familyId" TEXT NOT NULL,
    "userId" TEXT,
    "price" DOUBLE PRECISION NOT NULL,
    "quantity" DOUBLE PRECISION NOT NULL,
    "totalCost" DOUBLE PRECISION,
    "retailer" TEXT,
    "region" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "UserProductPrice_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "UserProductPrice_productId_idx" ON "UserProductPrice"("productId");

-- CreateIndex
CREATE INDEX "UserProductPrice_familyId_idx" ON "UserProductPrice"("familyId");

-- CreateIndex
CREATE INDEX "UserProductPrice_createdAt_idx" ON "UserProductPrice"("createdAt");

-- CreateIndex
CREATE INDEX "Product_category_idx" ON "Product"("category");

-- CreateIndex
CREATE INDEX "Product_name_idx" ON "Product"("name");

-- AddForeignKey
ALTER TABLE "UserProductPrice" ADD CONSTRAINT "UserProductPrice_productId_fkey" FOREIGN KEY ("productId") REFERENCES "Product"("id") ON DELETE CASCADE ON UPDATE CASCADE;
