import { NextResponse } from "next/server";

// 내부(슬랙봇 → 웹앱) 전용 write API 게이트.
// PLC_INTERNAL_SECRET가 설정돼 있으면 매치 여부를 검사하고, 없으면 통과(로컬 개발용).
export function assertInternalSecret(req) {
  const expected = process.env.PLC_INTERNAL_SECRET;
  if (!expected) return null; // 미설정 시 게이트 비활성
  const got = req.headers.get("x-plc-secret") || "";
  if (got.length !== expected.length || got !== expected) {
    return NextResponse.json(
      { error: "unauthorized (internal endpoint)" },
      { status: 401 }
    );
  }
  return null;
}
