-- CreateTable
CREATE TABLE "ChatExtension" (
    "chat_id" TEXT NOT NULL,
    "ext_id" TEXT NOT NULL,
    "settings_json" JSONB NOT NULL DEFAULT '{}',

    CONSTRAINT "ChatExtension_pkey" PRIMARY KEY ("chat_id","ext_id")
);

-- AddForeignKey
ALTER TABLE "ChatExtension" ADD CONSTRAINT "ChatExtension_chat_id_fkey" FOREIGN KEY ("chat_id") REFERENCES "Chat"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ChatExtension" ADD CONSTRAINT "ChatExtension_ext_id_fkey" FOREIGN KEY ("ext_id") REFERENCES "Extension"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
