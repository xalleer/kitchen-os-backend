/*
  Warnings:

  - You are about to drop the column `allergies` on the `FamilyMember` table. All the data in the column will be lost.
  - You are about to drop the column `dislikedProducts` on the `FamilyMember` table. All the data in the column will be lost.

*/
-- AlterTable
ALTER TABLE "FamilyMember" DROP COLUMN "allergies",
DROP COLUMN "dislikedProducts";

-- DropEnum
DROP TYPE "Role";

-- CreateTable
CREATE TABLE "Allergy" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "slug" TEXT NOT NULL,

    CONSTRAINT "Allergy_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "_FamilyMemberToProduct" (
    "A" TEXT NOT NULL,
    "B" TEXT NOT NULL,

    CONSTRAINT "_FamilyMemberToProduct_AB_pkey" PRIMARY KEY ("A","B")
);

-- CreateTable
CREATE TABLE "_AllergyToFamilyMember" (
    "A" TEXT NOT NULL,
    "B" TEXT NOT NULL,

    CONSTRAINT "_AllergyToFamilyMember_AB_pkey" PRIMARY KEY ("A","B")
);

-- CreateIndex
CREATE UNIQUE INDEX "Allergy_name_key" ON "Allergy"("name");

-- CreateIndex
CREATE UNIQUE INDEX "Allergy_slug_key" ON "Allergy"("slug");

-- CreateIndex
CREATE INDEX "_FamilyMemberToProduct_B_index" ON "_FamilyMemberToProduct"("B");

-- CreateIndex
CREATE INDEX "_AllergyToFamilyMember_B_index" ON "_AllergyToFamilyMember"("B");

-- AddForeignKey
ALTER TABLE "_FamilyMemberToProduct" ADD CONSTRAINT "_FamilyMemberToProduct_A_fkey" FOREIGN KEY ("A") REFERENCES "FamilyMember"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "_FamilyMemberToProduct" ADD CONSTRAINT "_FamilyMemberToProduct_B_fkey" FOREIGN KEY ("B") REFERENCES "Product"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "_AllergyToFamilyMember" ADD CONSTRAINT "_AllergyToFamilyMember_A_fkey" FOREIGN KEY ("A") REFERENCES "Allergy"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "_AllergyToFamilyMember" ADD CONSTRAINT "_AllergyToFamilyMember_B_fkey" FOREIGN KEY ("B") REFERENCES "FamilyMember"("id") ON DELETE CASCADE ON UPDATE CASCADE;
