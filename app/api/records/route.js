import { NextResponse } from "next/server";
import { supabaseAdmin } from "../../../lib/supabase";
import { composeImageBuffer } from "../../../lib/compose";

export const runtime = "nodejs";

// GET /api/records  — 전체 인증 기록 (최신순)
export async function GET() {
  const db = supabaseAdmin();
  const { data, error } = await db
    .from("records")
    .select("*")
    .order("created_at", { ascending: false });
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data);
}

// POST /api/records — 웹앱에서 인증 추가
// body: { memberId, num, memo, date, time, imageBase64 }
export async function POST(req) {
  const db = supabaseAdmin();
  const body = await req.json();
  const { memberId, num, memo = "", date, time = null, imageBase64, preComposed = false } = body;
  if (!memberId || !num || !date || !imageBase64) {
    return NextResponse.json({ error: "필수 항목 누락" }, { status: 400 });
  }

  const b64 = imageBase64.split(",").pop();
  const raw = Buffer.from(b64, "base64");

  let composed;
  if (preComposed) {
    // 웹앱에서 크롭·합성까지 마친 이미지 → 그대로 저장
    composed = raw;
  } else {
    // 원본만 온 경우(슬랙 등) → 서버에서 합성
    const { data: pocket } = await db
      .from("pockets")
      .select("title")
      .eq("member_id", memberId)
      .eq("num", num)
      .maybeSingle();
    composed = await composeImageBuffer(raw, {
      num,
      title: pocket?.title || "",
      dateStr: date,
      timeStr: time,
    });
  }

  const fileName = `${memberId}/${Date.now()}_${num}.jpg`;
  const { error: upErr } = await db.storage
    .from("pocket-photos")
    .upload(fileName, composed, { contentType: "image/jpeg" });
  if (upErr) return NextResponse.json({ error: upErr.message }, { status: 500 });

  const { data: pub } = db.storage.from("pocket-photos").getPublicUrl(fileName);

  const { data, error } = await db
    .from("records")
    .insert({
      member_id: memberId,
      num,
      memo,
      image_url: pub.publicUrl,
      date,
      time,
      source: "web",
    })
    .select()
    .single();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data);
}

// DELETE /api/records?id=xxx&memberId=yyy — 본인 것만 삭제
export async function DELETE(req) {
  const db = supabaseAdmin();
  const { searchParams } = new URL(req.url);
  const id = searchParams.get("id");
  const memberId = searchParams.get("memberId");
  if (!id || !memberId)
    return NextResponse.json({ error: "id/memberId 필요" }, { status: 400 });

  // 소유자 확인 (본인 것만)
  const { data: rec } = await db
    .from("records")
    .select("member_id")
    .eq("id", id)
    .maybeSingle();
  if (!rec) return NextResponse.json({ error: "없는 기록" }, { status: 404 });
  if (rec.member_id !== memberId)
    return NextResponse.json({ error: "본인 기록만 삭제할 수 있어요" }, { status: 403 });

  const { error } = await db.from("records").delete().eq("id", id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
