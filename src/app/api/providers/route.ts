import { NextRequest, NextResponse } from "next/server";
import { getSignalProviders, createSignalProvider, deleteSignalProvider, getSignalProviderStats } from "@/lib/db";
import { z } from "zod";

export const dynamic = "force-dynamic";

const ProviderSchema = z.object({
  id: z.string().optional(),
  name: z.string().min(1, "Name is required").max(100),
  notes: z.string().optional().default(""),
  telegram_handle: z.string().optional().default(""),
  color: z.string().optional().default("sky"),
});

export async function GET(req: NextRequest) {
  try {
    const [providers, stats] = await Promise.all([
      getSignalProviders(),
      getSignalProviderStats(),
    ]);

    return NextResponse.json({
      success: true,
      providers,
      stats,
    });
  } catch (error: any) {
    console.error("[API providers GET] Error:", error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const validated = ProviderSchema.parse(body);

    const provider = await createSignalProvider(validated);
    return NextResponse.json({ success: true, provider }, { status: 201 });
  } catch (error: any) {
    console.error("[API providers POST] Error:", error);
    if (error instanceof z.ZodError) {
      return NextResponse.json({ success: false, error: error.errors[0].message }, { status: 400 });
    }
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const id = searchParams.get("id");
    const name = searchParams.get("name");

    const target = id || name;
    if (!target) {
      return NextResponse.json({ success: false, error: "id or name is required" }, { status: 400 });
    }

    if (target.toLowerCase() === "self") {
      return NextResponse.json({ success: false, error: "Cannot delete 'Self' category" }, { status: 400 });
    }

    await deleteSignalProvider(target);
    return NextResponse.json({ success: true, message: "Signal provider deleted" });
  } catch (error: any) {
    console.error("[API providers DELETE] Error:", error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
