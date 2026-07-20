// 서버(Node)에서 사진에 넘버/제목/날짜/로고를 합성합니다.
// @napi-rs/canvas 사용 (Vercel 서버리스에서 동작).
import { createCanvas, loadImage, GlobalFonts } from "@napi-rs/canvas";
import path from "path";
import fs from "fs";

// 폰트 등록 (public/fonts 에 파일이 있으면 사용)
let fontsReady = false;
function ensureFonts() {
  if (fontsReady) return;
  const dir = path.join(process.cwd(), "public", "fonts");
  const reg = (file, family) => {
    const p = path.join(dir, file);
    if (fs.existsSync(p)) GlobalFonts.registerFromPath(p, family);
  };
  reg("BlackHanSans-Regular.ttf", "TitleKR");
  reg("AlfaSlabOne-Regular.ttf", "Logo");
  reg("NotoSansKR-Bold.ttf", "BodyKR");
  fontsReady = true;
}

function formatDateDots(dateStr) {
  if (!dateStr) return "";
  const [y, m, d] = dateStr.split("-");
  return `${y}.${m}.${d}`;
}

function wrapText(ctx, text, maxW, maxLines) {
  const lines = [];
  let cur = "";
  for (const ch of text) {
    if (ctx.measureText(cur + ch).width > maxW && cur) {
      lines.push(cur);
      cur = ch;
      if (lines.length === maxLines) break;
    } else cur += ch;
  }
  if (lines.length < maxLines && cur) lines.push(cur);
  if (lines.length === maxLines && cur && lines[maxLines - 1] !== cur) {
    lines[maxLines - 1] = lines[maxLines - 1].slice(0, -1) + "…";
  }
  return lines;
}

// imageBuffer(원본) → 1080x1080 합성 JPEG Buffer 반환
export async function composeImageBuffer(imageBuffer, { num, title, dateStr, timeStr }) {
  ensureFonts();
  const S = 1080;
  const img = await loadImage(imageBuffer);
  const canvas = createCanvas(S, S);
  const x = canvas.getContext("2d");

  // cover-crop 정사각형
  const r = Math.max(S / img.width, S / img.height);
  const w = img.width * r, h = img.height * r;
  x.drawImage(img, (S - w) / 2, (S - h) / 2, w, h);

  x.shadowColor = "rgba(0,0,0,0.5)";
  x.shadowBlur = 12;
  x.shadowOffsetY = 2;

  // 상단: 넘버 + 제목 (가로폭 맞춰 자동 크기, 최대 3줄)
  const label = `${num}. ${title || ""}`.trim();
  const maxW = S - 100;
  x.fillStyle = "#ffffff";
  x.textBaseline = "top";
  x.textAlign = "left";
  x.font = `100px TitleKR`;
  const w100 = x.measureText(label).width || 1;
  let size = Math.min(104, (100 * maxW) / w100);
  let lines = [label];
  if (size < 48) {
    let chosen = null, chosenSize = 30;
    for (let s = 64; s >= 30; s -= 2) {
      x.font = `${s}px TitleKR`;
      const ls = wrapText(x, label, maxW, 10);
      if (ls.length <= 3) { chosen = ls; chosenSize = s; break; }
    }
    if (!chosen) { x.font = `30px TitleKR`; chosen = wrapText(x, label, maxW, 3); }
    lines = chosen; size = chosenSize;
  }
  x.font = `${size}px TitleKR`;
  lines.forEach((ln, i) => x.fillText(ln, 50, 44 + i * size * 1.18));

  // 하단: 날짜(좌) + 로고(우)
  x.fillStyle = "#ffffff";
  x.textBaseline = "alphabetic";
  x.font = `34px Logo`;
  x.textAlign = "left";
  x.fillText(formatDateDots(dateStr) + (timeStr ? ` ${timeStr}` : ""), 50, S - 46);
  x.textAlign = "right";
  x.fillText("100 POCKET LIST CLUB", S - 46, S - 46);

  return canvas.toBuffer("image/jpeg", 85);
}
