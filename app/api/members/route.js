import { NextResponse } from "next/server";
import { supabaseAdmin } from "../../../lib/supabase";

export const runtime = "nodejs";

// GET /api/members
export async function GET() {
  const db = supabaseAdmin();
  const { data, error } = await db
    .from("members")
    .select("*")
    .order("created_at", { ascending: true });
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data);
}

// POST /api/members  body: { name }
export async function POST(req) {
  const db = supabaseAdmin();
  const { name } = await req.json();
  if (!name?.trim())
    return NextResponse.json({ error: "이름 필요" }, { status: 400 });

  const { data: member, error } = await db
    .from("members")
    .insert({ name: name.trim() })
    .select()
    .single();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  // 빈 포켓 10개 생성
  const rows = Array.from({ length: 10 }, (_, i) => ({
    member_id: member.id,
    num: i + 1,
  }));
  await db.from("pockets").insert(rows);

  return NextResponse.json(member);
}

// PATCH /api/members  body: { id, name }
export async function PATCH(req) {
  const db = supabaseAdmin();
  const { id, name } = await req.json();
  if (!id || !name?.trim())
    return NextResponse.json({ error: "id/name 필요" }, { status: 400 });
  const { data, error } = await db
    .from("members")
    .update({ name: name.trim() })
    .eq("id", id)
    .select()
    .single();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data);
}

// DELETE /api/members?id=xxx
export async function DELETE(req) {
  const db = supabaseAdmin();
  const { searchParams } = new URL(req.url);
  const id = searchParams.get("id");
  if (!id) return NextResponse.json({ error: "id 필요" }, { status: 400 });
  // pockets/records는 on delete cascade로 함께 삭제됨
  const { error } = await db.from("members").delete().eq("id", id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
