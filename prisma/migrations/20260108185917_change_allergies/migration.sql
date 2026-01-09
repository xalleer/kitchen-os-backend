/*
  Warnings:

  - You are about to drop the column `allergies` on the `UserPreference` table. All the data in the column will be lost.

*/
-- AlterTable
ALTER TABLE "UserPreference" DROP COLUMN "allergies";

-- CreateTable
CREATE TABLE "_AllergyToUserPreference" (
    "A" TEXT NOT NULL,
    "B" TEXT NOT NULL,

    CONSTRAINT "_AllergyToUserPreference_AB_pkey" PRIMARY KEY ("A","B")
);

-- CreateIndex
CREATE INDEX "_AllergyToUserPreference_B_index" ON "_AllergyToUserPreference"("B");

-- AddForeignKey
ALTER TABLE "_AllergyToUserPreference" ADD CONSTRAINT "_AllergyToUserPreference_A_fkey" FOREIGN KEY ("A") REFERENCES "Allergy"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "_AllergyToUserPreference" ADD CONSTRAINT "_AllergyToUserPreference_B_fkey" FOREIGN KEY ("B") REFERENCES "UserPreference"("id") ON DELETE CASCADE ON UPDATE CASCADE;
