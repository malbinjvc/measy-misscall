/**
 * Cloud storage abstraction for file uploads.
 * Production: Google Cloud Storage (GCS)
 * Development: local filesystem fallback
 */
import { Storage } from "@google-cloud/storage";
import { writeFile, mkdir } from "fs/promises";
import path from "path";

const GCS_BUCKET = process.env.GCS_BUCKET_NAME;
const useGCS = !!GCS_BUCKET;

// Lazy-init GCS client only when needed
let _storage: Storage | null = null;
function getStorage(): Storage {
  if (!_storage) {
    _storage = new Storage();
  }
  return _storage;
}

interface UploadResult {
  url: string;
  filename: string;
}

/**
 * Upload a file buffer to storage.
 * Returns the public URL.
 *
 * @param buffer - File contents
 * @param filename - Desired filename (will be placed under folder/)
 * @param folder - Subfolder (e.g. "uploads", "uploads/reviews", "uploads/ivr")
 * @param contentType - MIME type
 */
export async function uploadFile(
  buffer: Buffer,
  filename: string,
  folder: string,
  contentType?: string
): Promise<UploadResult> {
  const key = `${folder}/${filename}`;

  if (useGCS) {
    const bucket = getStorage().bucket(GCS_BUCKET!);
    const file = bucket.file(key);

    await file.save(buffer, {
      metadata: {
        contentType: contentType || "application/octet-stream",
        cacheControl: "public, max-age=31536000, immutable",
      },
      resumable: false,
    });

    // Public URL — requires bucket to have uniform public access or signed URLs
    const url = `https://storage.googleapis.com/${GCS_BUCKET}/${key}`;
    return { url, filename };
  }

  // Local filesystem fallback (development only)
  const localDir = path.join(process.cwd(), "public", folder);
  await mkdir(localDir, { recursive: true });
  await writeFile(path.join(localDir, filename), buffer);
  return { url: `/${folder}/${filename}`, filename };
}

/**
 * Check if a file exists in storage.
 */
export async function fileExists(folder: string, filename: string): Promise<boolean> {
  const key = `${folder}/${filename}`;

  if (useGCS) {
    const bucket = getStorage().bucket(GCS_BUCKET!);
    const [exists] = await bucket.file(key).exists();
    return exists;
  }

  // Local fallback
  const fs = await import("fs");
  return fs.existsSync(path.join(process.cwd(), "public", folder, filename));
}

/**
 * Get the public URL for a file.
 */
export function getFileUrl(folder: string, filename: string): string {
  if (useGCS) {
    return `https://storage.googleapis.com/${GCS_BUCKET}/${folder}/${filename}`;
  }
  return `/${folder}/${filename}`;
}
