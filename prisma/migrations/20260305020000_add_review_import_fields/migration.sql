-- AlterTable
ALTER TABLE "Review" ALTER COLUMN "customerPhone" DROP NOT NULL;

-- AlterTable
ALTER TABLE "Review" ADD COLUMN "imageUrls" TEXT[] DEFAULT ARRAY[]::TEXT[];
ALTER TABLE "Review" ADD COLUMN "importSource" TEXT;
