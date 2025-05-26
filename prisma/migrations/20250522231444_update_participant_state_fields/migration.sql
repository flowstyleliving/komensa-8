/*
  Warnings:

  - You are about to drop the column `state` on the `ParticipantState` table. All the data in the column will be lost.

*/
-- AlterTable
ALTER TABLE "ParticipantState" DROP COLUMN "state",
ADD COLUMN     "feelings" JSONB NOT NULL DEFAULT '[]',
ADD COLUMN     "needs" JSONB NOT NULL DEFAULT '[]',
ADD COLUMN     "viewpoints" JSONB NOT NULL DEFAULT '[]';
