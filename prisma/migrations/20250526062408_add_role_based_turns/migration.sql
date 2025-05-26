-- AlterTable
ALTER TABLE "ChatTurnState" ADD COLUMN     "current_turn_index" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "next_role" TEXT,
ADD COLUMN     "turn_queue" JSONB NOT NULL DEFAULT '[]';
