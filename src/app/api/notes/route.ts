import { NextRequest, NextResponse } from "next/server";
import { getNotes, createNote, updateNote, deleteNote } from "@/lib/db";
import { TradingNote } from "@/lib/types";
import { z } from "zod";

export const dynamic = "force-dynamic";

const CreateNoteSchema = z.object({
  account_id: z.string().optional().default("acc_default"),
  title: z.string().trim().min(1, "Title is required").max(200),
  content: z.string().max(50000).optional().default(""),
  category: z.string().trim().max(48).optional().default("GENERAL"),
  symbol: z.string().trim().max(32).optional().default(""),
  tags: z.array(z.string().trim().max(40)).max(20).optional().default([]),
  is_pinned: z.boolean().optional().default(false),
  note_date: z.string().optional(),
  image_url: z.string().max(500000).optional().default(""),
});

const UpdateNoteSchema = z.object({
  id: z.string().min(1, "Note ID is required"),
  account_id: z.string().optional(),
  title: z.string().trim().min(1).max(200).optional(),
  content: z.string().max(50000).optional(),
  category: z.string().trim().max(48).optional(),
  symbol: z.string().trim().max(32).optional(),
  tags: z.array(z.string().trim().max(40)).max(20).optional(),
  is_pinned: z.boolean().optional(),
  note_date: z.string().optional(),
  image_url: z.string().max(500000).optional(),
});

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const account_id = searchParams.get("account_id") || undefined;
    const search = searchParams.get("search") || undefined;
    const category = searchParams.get("category") || undefined;
    const startDate = searchParams.get("startDate") || undefined;
    const endDate = searchParams.get("endDate") || undefined;

    const notes = await getNotes({ account_id, search, category, startDate, endDate });
    return NextResponse.json({ success: true, count: notes.length, notes });
  } catch (error: any) {
    console.error("[API notes GET] Error:", error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const validated = CreateNoteSchema.parse(body);

    const now = new Date().toISOString();
    const id = `note_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;

    const noteDate = validated.note_date
      ? new Date(validated.note_date).toISOString()
      : now;

    const newNote: TradingNote = {
      id,
      account_id: validated.account_id && validated.account_id !== "ALL" ? validated.account_id : "acc_default",
      title: validated.title,
      content: validated.content,
      category: validated.category || "GENERAL",
      symbol: (validated.symbol || "").toUpperCase(),
      tags: validated.tags || [],
      is_pinned: Boolean(validated.is_pinned),
      note_date: noteDate,
      image_url: validated.image_url || "",
      created_at: now,
      updated_at: now,
    };

    const saved = await createNote(newNote);
    return NextResponse.json({ success: true, note: saved }, { status: 201 });
  } catch (error: any) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ success: false, error: error.errors[0].message }, { status: 400 });
    }
    console.error("[API notes POST] Error:", error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}

export async function PUT(req: NextRequest) {
  try {
    const body = await req.json();
    const validated = UpdateNoteSchema.parse(body);
    const { id, ...updates } = validated;

    const updated = await updateNote(id, updates);
    if (!updated) {
      return NextResponse.json({ success: false, error: "Note not found" }, { status: 404 });
    }
    return NextResponse.json({ success: true, note: updated });
  } catch (error: any) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ success: false, error: error.errors[0].message }, { status: 400 });
    }
    console.error("[API notes PUT] Error:", error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const id = searchParams.get("id");
    if (!id) {
      return NextResponse.json({ success: false, error: "Note ID is required" }, { status: 400 });
    }

    const ok = await deleteNote(id);
    if (!ok) {
      return NextResponse.json({ success: false, error: "Note not found" }, { status: 404 });
    }
    return NextResponse.json({ success: true, deleted: id });
  } catch (error: any) {
    console.error("[API notes DELETE] Error:", error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
