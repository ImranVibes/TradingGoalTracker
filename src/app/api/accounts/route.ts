import { NextRequest, NextResponse } from "next/server";
import { getAccounts, createAccount, updateAccount, deleteAccount } from "@/lib/db";
import { z } from "zod";

export const dynamic = "force-dynamic";

const CreateAccountSchema = z.object({
  name: z.string().min(1, "Account name is required").max(120),
  type: z.enum(["PERSONAL", "TARGET", "RECOVERY", "FUNDED"]).default("TARGET"),
  starting_balance: z.coerce.number().default(0),
  target_amount: z.coerce.number().default(0),
  initial_loss: z.coerce.number().default(0),
  color: z.string().default("emerald"),
  notes: z.string().optional().default(""),
});

const UpdateAccountSchema = z.object({
  id: z.string().min(1, "Account ID is required"),
  name: z.string().min(1).max(120).optional(),
  type: z.enum(["PERSONAL", "TARGET", "RECOVERY", "FUNDED"]).optional(),
  starting_balance: z.coerce.number().optional(),
  target_amount: z.coerce.number().optional(),
  initial_loss: z.coerce.number().optional(),
  color: z.string().optional(),
  notes: z.string().optional(),
});

export async function GET() {
  try {
    const accounts = await getAccounts();
    return NextResponse.json({ success: true, accounts });
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const validated = CreateAccountSchema.parse(body);
    const created = await createAccount(validated);
    return NextResponse.json({ success: true, account: created }, { status: 201 });
  } catch (error: any) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ success: false, error: error.errors[0].message }, { status: 400 });
    }
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}

export async function PUT(req: NextRequest) {
  try {
    const body = await req.json();
    const validated = UpdateAccountSchema.parse(body);
    const { id, ...updates } = validated;
    const updated = await updateAccount(id, updates);
    if (!updated) {
      return NextResponse.json({ success: false, error: "Account not found" }, { status: 404 });
    }
    return NextResponse.json({ success: true, account: updated });
  } catch (error: any) {
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
    if (!id) {
      return NextResponse.json({ success: false, error: "Account ID is required" }, { status: 400 });
    }
    await deleteAccount(id);
    return NextResponse.json({ success: true, message: "Account deleted (trades moved to Main Account)" });
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message }, { status: 400 });
  }
}
