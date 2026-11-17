import { NextRequest, NextResponse } from "next/server";
import { deleteCashflow } from "@/lib/db";

export async function DELETE(req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const deleted = await deleteCashflow(params.id);
    if (!deleted) {
      return NextResponse.json({ success: false, error: "Cashflow record not found" }, { status: 404 });
    }
    return NextResponse.json({ success: true, message: "Record deleted successfully" });
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
