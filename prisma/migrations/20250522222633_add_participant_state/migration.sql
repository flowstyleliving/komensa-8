-- CreateTable
CREATE TABLE "ParticipantState" (
    "chat_id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "state" JSONB NOT NULL,

    CONSTRAINT "ParticipantState_pkey" PRIMARY KEY ("chat_id","user_id")
);

-- AddForeignKey
ALTER TABLE "ParticipantState" ADD CONSTRAINT "ParticipantState_chat_id_fkey" FOREIGN KEY ("chat_id") REFERENCES "Chat"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ParticipantState" ADD CONSTRAINT "ParticipantState_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
