/*
  Warnings:

  - You are about to drop the column `dislikedProducts` on the `UserPreference` table. All the data in the column will be lost.
  - You are about to drop the `_FamilyMemberToProduct` table. If the table is not empty, all the data it contains will be lost.

*/
-- DropForeignKey
ALTER TABLE "_FamilyMemberToProduct" DROP CONSTRAINT "_FamilyMemberToProduct_A_fkey";

-- DropForeignKey
ALTER TABLE "_FamilyMemberToProduct" DROP CONSTRAINT "_FamilyMemberToProduct_B_fkey";

-- AlterTable
ALTER TABLE "Product" ADD COLUMN     "familyMemberId" TEXT;

-- AlterTable
ALTER TABLE "UserPreference" DROP COLUMN "dislikedProducts";

-- DropTable
DROP TABLE "_FamilyMemberToProduct";

-- AddForeignKey
ALTER TABLE "Product" ADD CONSTRAINT "Product_familyMemberId_fkey" FOREIGN KEY ("familyMemberId") REFERENCES "FamilyMember"("id") ON DELETE SET NULL ON UPDATE CASCADE;
