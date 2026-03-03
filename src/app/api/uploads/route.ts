import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { writeFile, mkdir } from "fs/promises";
import path from "path";
import { checkRateLimit, getClientIp } from "@/lib/rate-limit";

const ALLOWED_IMAGE_TYPES = ["image/jpeg", "image/png", "image/webp", "image/gif"];
const ALLOWED_VIDEO_TYPES = ["video/mp4", "video/webm"];
const ALLOWED_TYPES = [...ALLOWED_IMAGE_TYPES, ...ALLOWED_VIDEO_TYPES];
const MAX_FILE_SIZE = 20 * 1024 * 1024; // 20MB

export async function POST(req: NextRequest) {
  try {
    const ip = getClientIp(req);
    const limit = checkRateLimit(`upload:${ip}`, { max: 10, windowSec: 60 });
    if (!limit.allowed) return NextResponse.json({ success: false, error: "Too many uploads" }, { status: 429 });

    const session = await getServerSession(authOptions);
    if (!session?.user?.tenantId) {
      return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });
    }

    const formData = await req.formData();
    const file = formData.get("file") as File | null;

    if (!file) {
      return NextResponse.json({ success: false, error: "No file provided" }, { status: 400 });
    }

    if (!ALLOWED_TYPES.includes(file.type)) {
      return NextResponse.json(
        { success: false, error: "Invalid file type. Allowed: JPEG, PNG, WebP, GIF, MP4, WebM" },
        { status: 400 }
      );
    }

    if (file.size > MAX_FILE_SIZE) {
      return NextResponse.json(
        { success: false, error: "File too large. Maximum size is 20MB" },
        { status: 400 }
      );
    }

    // Validate magic bytes match declared MIME type
    const buffer = Buffer.from(await file.arrayBuffer());
    const magicBytes = buffer.subarray(0, 8);
    const magicMap: Record<string, number[][]> = {
      "image/jpeg": [[0xFF, 0xD8, 0xFF]],
      "image/png": [[0x89, 0x50, 0x4E, 0x47]],
      "image/gif": [[0x47, 0x49, 0x46, 0x38]],
      "image/webp": [[0x52, 0x49, 0x46, 0x46]], // RIFF header
      "video/mp4": [[0x00, 0x00, 0x00], [0x66, 0x74, 0x79, 0x70]], // ftyp box (offset varies)
    };

    const expectedMagic = magicMap[file.type];
    if (expectedMagic) {
      const matchesMagic = expectedMagic.some(magic =>
        magic.every((byte, i) => magicBytes[i] === byte)
      );
      if (!matchesMagic) {
        return NextResponse.json({ success: false, error: "File content does not match declared type" }, { status: 400 });
      }
    }

    // Generate unique filename
    const ext = path.extname(file.name) || `.${file.type.split("/")[1]}`;
    const filename = `${session.user.tenantId}-${Date.now()}${ext}`;

    // Ensure uploads directory exists
    const uploadsDir = path.join(process.cwd(), "public", "uploads");
    await mkdir(uploadsDir, { recursive: true });

    // Write file to disk (reuse buffer from magic byte validation)
    const filePath = path.join(uploadsDir, filename);
    await writeFile(filePath, buffer);

    // Determine media type
    const mediaType = ALLOWED_VIDEO_TYPES.includes(file.type) ? "video" : "image";

    return NextResponse.json({
      success: true,
      data: {
        url: `/uploads/${filename}`,
        mediaType,
        filename,
      },
    });
  } catch (error) {
    console.error("Upload error:", error);
    return NextResponse.json({ success: false, error: "Upload failed" }, { status: 500 });
  }
}
