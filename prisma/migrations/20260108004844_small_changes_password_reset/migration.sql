/*
  Warnings:

  - You are about to drop the column `passwordResetTokenHash` on the `User` table. All the data in the column will be lost.

*/
-- DropIndex
DROP INDEX "User_passwordResetTokenHash_key";

-- AlterTable
ALTER TABLE "User" DROP COLUMN "passwordResetTokenHash",
ADD COLUMN     "passwordResetCodeHash" TEXT;
