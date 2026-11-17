import { NextRequest, NextResponse } from "next/server";
import fs from "fs";
import path from "path";

export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  try {
    const contentType = req.headers.get("content-type") || "";

    if (contentType.includes("application/json")) {
      const { image, filename: clientFilename } = await req.json();
      if (!image) {
        return NextResponse.json({ success: false, error: "No image data provided" }, { status: 400 });
      }

      // If it's a data URL, we can save it to public/uploads or return it
      const matches = image.match(/^data:([A-Za-z-+\/]+);base64,(.+)$/);
      if (matches && matches.length === 3) {
        const ext = matches[1].split("/")[1] || "png";
        const buffer = Buffer.from(matches[2], "base64");

        const uploadsDir = path.join(process.cwd(), "public", "uploads");
        if (!fs.existsSync(uploadsDir)) {
          try {
            fs.mkdirSync(uploadsDir, { recursive: true });
          } catch {}
        }

        const filename = `chart_${Date.now()}_${Math.random().toString(36).substring(2, 7)}.${ext}`;
        const filePath = path.join(uploadsDir, filename);

        try {
          fs.writeFileSync(filePath, buffer);
          return NextResponse.json({
            success: true,
            url: `/uploads/${filename}`,
          });
        } catch {
          // If disk write fails, return the data URL directly so it works resiliently
          return NextResponse.json({
            success: true,
            url: image,
          });
        }
      }

      return NextResponse.json({ success: true, url: image });
    }

    // FormData multipart upload
    const formData = await req.formData();
    const file = formData.get("file") as File;
    if (!file) {
      return NextResponse.json({ success: false, error: "No file uploaded" }, { status: 400 });
    }

    const buffer = Buffer.from(await file.arrayBuffer());
    const uploadsDir = path.join(process.cwd(), "public", "uploads");
    if (!fs.existsSync(uploadsDir)) {
      try {
        fs.mkdirSync(uploadsDir, { recursive: true });
      } catch {}
    }

    const ext = file.name.split(".").pop() || "png";
    const filename = `chart_${Date.now()}_${Math.random().toString(36).substring(2, 7)}.${ext}`;
    const filePath = path.join(uploadsDir, filename);

    try {
      fs.writeFileSync(filePath, buffer);
      return NextResponse.json({
        success: true,
        url: `/uploads/${filename}`,
      });
    } catch {
      const base64 = `data:${file.type || "image/png"};base64,${buffer.toString("base64")}`;
      return NextResponse.json({
        success: true,
        url: base64,
      });
    }
  } catch (error: any) {
    console.error("[API upload POST] Error:", error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
