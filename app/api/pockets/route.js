import { NextResponse } from "next/server";
import { supabaseAdmin } from "../../../lib/supabase";
import { assertInternalSecret } from "../../../lib/authGate";

export const runtime = "nodejs";

// GET /api/pockets  — 모든 멤버의 포켓 항목
export async function GET() {
  const db = supabaseAdmin();
  const { data, error } = await db.from("pockets").select("*");
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data);
}

// PATCH /api/pockets  body: { memberId, num, title, description }
export async function PATCH(req) {
  const gate = assertInternalSecret(req);
  if (gate) return gate;
  const db = supabaseAdmin();
  const { memberId, num, title = "", description = "" } = await req.json();
  if (!memberId || !num)
    return NextResponse.json({ error: "memberId/num 필요" }, { status: 400 });

  const { data, error } = await db
    .from("pockets")
    .update({ title: title.slice(0, 100), description, updated_at: new Date().toISOString() })
    .eq("member_id", memberId)
    .eq("num", num)
    .select()
    .single();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data);
}
