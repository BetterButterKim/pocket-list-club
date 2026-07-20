import { NextResponse } from "next/server";
import crypto from "crypto";
import { supabaseAdmin } from "../../../lib/supabase";
import { composeImageBuffer } from "../../../lib/compose";

export const runtime = "nodejs";

/* ---------- 슬랙 서명 검증 ---------- */
function verifySlack(rawBody, headers) {
  const ts = headers.get("x-slack-request-timestamp");
  const sig = headers.get("x-slack-signature");
  if (!ts || !sig) return false;
  // 5분 이상 지난 요청은 거부 (재전송 공격 방지)
  if (Math.abs(Date.now() / 1000 - Number(ts)) > 60 * 5) return false;
  const base = `v0:${ts}:${rawBody}`;
  const mine =
    "v0=" +
    crypto
      .createHmac("sha256", process.env.SLACK_SIGNING_SECRET)
      .update(base)
      .digest("hex");
  try {
    return crypto.timingSafeEqual(Buffer.from(mine), Buffer.from(sig));
  } catch {
    return false;
  }
}

/* ---------- 멤버 찾기/자동 생성 ---------- */
async function getOrCreateMember(db, slackUserId, slackUserName) {
  let { data: m } = await db
    .from("members")
    .select("*")
    .eq("slack_user_id", slackUserId)
    .maybeSingle();
  if (m) return m;

  // 슬랙 표시이름과 같은 이름의 멤버가 이미 있으면 연결
  const { data: byName } = await db
    .from("members")
    .select("*")
    .eq("name", slackUserName)
    .is("slack_user_id", null)
    .maybeSingle();
  if (byName) {
    const { data: upd } = await db
      .from("members")
      .update({ slack_user_id: slackUserId })
      .eq("id", byName.id)
      .select()
      .single();
    return upd;
  }

  // 없으면 새로 생성 + 빈 포켓 10개
  const { data: created } = await db
    .from("members")
    .insert({ name: slackUserName, slack_user_id: slackUserId })
    .select()
    .single();
  const rows = Array.from({ length: 10 }, (_, i) => ({
    member_id: created.id,
    num: i + 1,
  }));
  await db.from("pockets").insert(rows);
  return created;
}

/* ---------- 슬랙에서 최근 첨부 이미지 가져오기 ---------- */
async function fetchLatestImage(channelId, slackUserId) {
  const token = process.env.SLACK_BOT_TOKEN;
  const res = await fetch(
    `https://slack.com/api/conversations.history?channel=${channelId}&limit=10`,
    { headers: { Authorization: `Bearer ${token}` } }
  );
  const data = await res.json();
  if (!data.ok || !data.messages) return null;
  // 이 사용자가 올린, 이미지 파일이 붙은 가장 최근 메시지
  for (const msg of data.messages) {
    if (msg.user !== slackUserId || !msg.files) continue;
    const f = msg.files.find((f) => (f.mimetype || "").startsWith("image/"));
    if (!f) continue;
    const imgRes = await fetch(f.url_private_download || f.url_private, {
      headers: { Authorization: `Bearer ${token}` },
    });
    const buf = Buffer.from(await imgRes.arrayBuffer());
    return buf;
  }
  return null;
}

/* ========================================================
   POST /api/slack  —  /시도 커맨드
   사용법:  /시도 <넘버> <메모>
   예)     /시도 3 오늘 아침 6시 러닝 완료!
   (사진은 같은 채널에 방금 올린 이미지에서 자동으로 가져옵니다)
   ======================================================== */
export async function POST(req) {
  const raw = await req.text();
  if (!verifySlack(raw, req.headers)) {
    return NextResponse.json({ error: "invalid signature" }, { status: 401 });
  }

  const params = new URLSearchParams(raw);
  const text = (params.get("text") || "").trim();
  const slackUserId = params.get("user_id");
  const slackUserName = params.get("user_name");
  const channelId = params.get("channel_id");

  // 넘버 파싱: 맨 앞 숫자
  const match = text.match(/^(\d{1,2})\s*(.*)$/s);
  if (!match) {
    return NextResponse.json({
      response_type: "ephemeral",
      text: "사용법: `/시도 <넘버> <메모>` 예) `/시도 3 오늘 아침 러닝 완료!`\n먼저 사진을 채널에 올린 뒤 명령을 입력해 주세요.",
    });
  }
  const num = Number(match[1]);
  const memo = (match[2] || "").trim();
  if (num < 1 || num > 10) {
    return NextResponse.json({
      response_type: "ephemeral",
      text: "포켓리스트 넘버는 1~10 사이여야 해요.",
    });
  }

  // 3초 제한 때문에 먼저 응답하고, 백그라운드로 처리
  processInBackground({ num, memo, slackUserId, slackUserName, channelId }).catch(
    (e) => console.error("배경 처리 실패:", e)
  );

  return NextResponse.json({
    response_type: "ephemeral",
    text: `⏳ ${num}번 인증을 등록하는 중이에요… 잠시 후 채널에 결과가 올라와요!`,
  });
}

async function processInBackground({ num, memo, slackUserId, slackUserName, channelId }) {
  const db = supabaseAdmin();
  const token = process.env.SLACK_BOT_TOKEN;
  const notify = (t) =>
    fetch("https://slack.com/api/chat.postMessage", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ channel: channelId, text: t }),
    });

  try {
    const member = await getOrCreateMember(db, slackUserId, slackUserName);

    const imgBuf = await fetchLatestImage(channelId, slackUserId);
    if (!imgBuf) {
      await notify(
        `<@${slackUserId}> 최근에 올린 사진을 찾지 못했어요. 사진을 먼저 올린 뒤 \`/시도\`를 입력해 주세요.`
      );
      return;
    }

    // 포켓 제목 조회
    const { data: pocket } = await db
      .from("pockets")
      .select("title")
      .eq("member_id", member.id)
      .eq("num", num)
      .maybeSingle();

    const now = new Date();
    const pad = (n) => String(n).padStart(2, "0");
    const dateStr = `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`;
    const timeStr = `${pad(now.getHours())}:${pad(now.getMinutes())}`;

    const composed = await composeImageBuffer(imgBuf, {
      num,
      title: pocket?.title || "",
      dateStr,
      timeStr,
    });

    // Storage 업로드
    const fileName = `${member.id}/${Date.now()}_${num}.jpg`;
    const { error: upErr } = await db.storage
      .from("pocket-photos")
      .upload(fileName, composed, { contentType: "image/jpeg", upsert: false });
    if (upErr) throw upErr;

    const { data: pub } = db.storage.from("pocket-photos").getPublicUrl(fileName);

    // 기록 저장
    await db.from("records").insert({
      member_id: member.id,
      num,
      memo,
      image_url: pub.publicUrl,
      date: dateStr,
      time: timeStr,
      source: "slack",
    });

    await notify(
      `✅ <@${slackUserId}> 님의 *${num}번${pocket?.title ? ` · ${pocket.title}` : ""}* 인증이 등록됐어요!${memo ? `\n> ${memo}` : ""}\n웹앱에서 확인해 보세요 🎉`
    );
  } catch (e) {
    console.error(e);
    await notify(`<@${slackUserId}> 인증 등록 중 문제가 생겼어요. 다시 시도해 주세요.`);
  }
}
