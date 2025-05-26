-- CreateTable
CREATE TABLE "MediatorProfile" (
    "id" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "assistant_id" TEXT NOT NULL,
    "system_prompt" TEXT,

    CONSTRAINT "MediatorProfile_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Extension" (
    "id" TEXT NOT NULL,
    "kind" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "latest_version" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Extension_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Product" (
    "id" TEXT NOT NULL,
    "stripe_product_id" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "ext_id" TEXT,

    CONSTRAINT "Product_pkey" PRIMARY KEY ("id")
);

-- AddForeignKey
ALTER TABLE "Product" ADD CONSTRAINT "Product_ext_id_fkey" FOREIGN KEY ("ext_id") REFERENCES "Extension"("id") ON DELETE SET NULL ON UPDATE CASCADE;
