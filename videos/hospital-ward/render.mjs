// 병실 생활 안내 영상 (천안본정형외과) - 무음 자막 영상 렌더러
// 사용법: node videos/hospital-ward/render.mjs [출력.mp4] [--frame 초] (프레임 PNG만 저장)
// 의존: skills/directing-stickman-videos/node_modules (npm ci), ffmpeg, 한글 글꼴(WenQuanYi Zen Hei)
import { createCanvas, GlobalFonts, loadImage } from '../../skills/directing-stickman-videos/node_modules/@napi-rs/canvas/index.js';
import { spawn } from 'node:child_process';
import fs from 'node:fs';

const W = 1280, H = 720, FPS = 24, DUR = 100;
const OW = 1920, OH = 1080; // 출력 해상도(1080p): 그림은 1280x720 좌표로 그리고 1.5배 확대 렌더링
const LOGO = await loadImage(fs.readFileSync(new URL('../assets/bone-logo.jpg', import.meta.url)));
const FONT = process.env.KR_FONT || '/usr/share/fonts/truetype/wqy/wqy-zenhei.ttc';
GlobalFonts.registerFromPath(FONT, 'KR');

const RED = '#e53935', BLUE = '#4a90d9', GOLD = '#e8a317', INK = '#111111';
const GROUND = 560;

const clamp = (v, a = 0, b = 1) => Math.min(b, Math.max(a, v));
const lerp = (a, b, k) => a + (b - a) * k;
const smooth = (k) => { k = clamp(k); return k * k * (3 - 2 * k); };
const seg = (t, a, b) => smooth((t - a) / (b - a));

// ---------- 기본 도형 ----------
function line(c, pts, color = INK, w = 5) {
  c.strokeStyle = color; c.lineWidth = w; c.lineCap = 'round'; c.lineJoin = 'round';
  c.beginPath(); pts.forEach(([x, y], i) => (i ? c.lineTo(x, y) : c.moveTo(x, y))); c.stroke();
}
function rr(c, x, y, w, h, r, stroke = INK, fill = null, lw = 5) {
  c.beginPath(); c.roundRect(x, y, w, h, r);
  if (fill) { c.fillStyle = fill; c.fill(); }
  if (stroke) { c.strokeStyle = stroke; c.lineWidth = lw; c.stroke(); }
}
function circle(c, x, y, r, stroke = INK, fill = null, lw = 5) {
  c.beginPath(); c.arc(x, y, r, 0, Math.PI * 2);
  if (fill) { c.fillStyle = fill; c.fill(); }
  if (stroke) { c.strokeStyle = stroke; c.lineWidth = lw; c.stroke(); }
}
function glow(c, x, y, r, color, alpha) {
  const g = c.createRadialGradient(x, y, 0, x, y, r);
  g.addColorStop(0, color + 'aa'); g.addColorStop(1, color + '00');
  c.save(); c.globalAlpha = alpha; c.fillStyle = g; c.beginPath(); c.arc(x, y, r, 0, Math.PI * 2); c.fill(); c.restore();
}

// ---------- 스틱맨 ----------
// pose: lean, legR{a,b}, legL{a,b}, armR{a,b}, armL{a,b}, face
function limb(a, b, l1, l2, ox, oy) {
  const mx = ox + l1 * Math.sin(a), my = oy + l1 * Math.cos(a);
  return [[ox, oy], [mx, my], [mx + l2 * Math.sin(b), my + l2 * Math.cos(b)]];
}
function walkPose(p, speed = 1) {
  const s = Math.sin(p), s2 = Math.sin(p + Math.PI);
  return {
    legR: { a: 0.5 * s, b: 0.5 * s - 0.5 * Math.max(0, Math.cos(p)) },
    legL: { a: 0.5 * s2, b: 0.5 * s2 - 0.5 * Math.max(0, Math.cos(p + Math.PI)) },
    armR: { a: -0.4 * s, b: -0.4 * s + 0.25 }, armL: { a: 0.4 * s, b: 0.4 * s + 0.25 },
  };
}
const STAND = { legR: { a: 0.08, b: 0.08 }, legL: { a: -0.08, b: -0.08 }, armR: { a: 0.12, b: 0.2 }, armL: { a: -0.12, b: -0.05 } };

function face(c, kind) {
  // 머리 중심 (0,-96), 단순한 선 표정 (눈은 짧은 선/점, 입은 곡선)
  c.save(); c.strokeStyle = INK; c.fillStyle = INK; c.lineWidth = 3; c.lineCap = 'round';
  const ey = -100;
  if (kind === 'wince') { line(c, [[-12, ey - 3], [-6, ey + 1]], INK, 3); line(c, [[12, ey - 3], [6, ey + 1]], INK, 3);
    c.beginPath(); c.moveTo(-7, -84); c.quadraticCurveTo(0, -90, 7, -84); c.stroke(); }
  else if (kind === 'puzzle') { circle(c, -9, ey, 2.5, null, INK); circle(c, 9, ey, 2.5, null, INK); line(c, [[-6, -86], [6, -88]], INK, 3); }
  else if (kind === 'smile') { circle(c, -9, ey, 2.5, null, INK); circle(c, 9, ey, 2.5, null, INK);
    c.beginPath(); c.arc(0, -90, 8, 0.15 * Math.PI, 0.85 * Math.PI); c.stroke(); }
  else { circle(c, -9, ey, 2.5, null, INK); circle(c, 9, ey, 2.5, null, INK); line(c, [[-6, -86], [6, -86]], INK, 3); }
  c.restore();
}

// 반환: 무릎/손 좌표(월드)
function figure(c, x, y, pose = {}, opts = {}) {
  const P = { ...STAND, ...pose };
  const hipY = y - 95, lean = pose.lean || 0, dir = opts.dir || 1;
  c.save(); c.translate(x, 0); c.scale(dir, 1);
  // 다리
  const lr = limb(P.legR.a, P.legR.b, 48, 47, 0, hipY), ll = limb(P.legL.a, P.legL.b, 48, 47, 0, hipY);
  line(c, lr); line(c, ll);
  const knee = { x: x + dir * lr[1][0], y: lr[1][1] };
  // 상체 (hip 기준 회전)
  c.save(); c.translate(0, hipY); c.rotate(lean);
  line(c, [[0, 0], [0, -70]]);
  circle(c, 0, -96, 24, INK, '#ffffff');
  face(c, P.face || 'flat');
  const aR = limb(P.armR.a, P.armR.b, 38, 36, 0, -70), aL = limb(P.armL.a, P.armL.b, 38, 36, 0, -70);
  line(c, aR); line(c, aL);
  c.restore();
  // 손 월드 좌표
  const rot = (px, py) => ({ x: x + dir * (px * Math.cos(lean) - (py) * Math.sin(lean)), y: hipY + (px * Math.sin(lean) + py * Math.cos(lean)) });
  const handR = rot(aR[2][0], aR[2][1]), handL = rot(aL[2][0], aL[2][1]);
  c.restore();
  return { knee, handR, handL, head: rot(0, -96) };
}

// ---------- 아이콘 ----------
function stairs(c, x, y, s = 1, color = INK) {
  line(c, [[x, y], [x, y - 40 * s], [x + 80 * s, y - 40 * s], [x + 80 * s, y - 80 * s], [x + 160 * s, y - 80 * s], [x + 160 * s, y - 120 * s], [x + 240 * s, y - 120 * s], [x + 240 * s, y]], color);
}
function calendar(c, x, y, w = 170, h = 150) {
  rr(c, x, y, w, h, 10, INK, '#fff'); line(c, [[x, y + 36], [x + w, y + 36]]);
  line(c, [[x + 40, y - 12], [x + 40, y + 12]]); line(c, [[x + w - 40, y - 12], [x + w - 40, y + 12]]);
  for (let i = 0; i < 3; i++) for (let j = 0; j < 4; j++) { circle(c, x + 28 + j * 38, y + 62 + i * 30, 3.2, null, INK); }
}
function hourglass(c, x, y, s = 1) {
  line(c, [[x - 30 * s, y - 50 * s], [x + 30 * s, y - 50 * s], [x - 30 * s, y + 50 * s], [x + 30 * s, y + 50 * s], [x - 30 * s, y - 50 * s]]);
  line(c, [[x - 36 * s, y - 50 * s], [x + 36 * s, y - 50 * s]]); line(c, [[x - 36 * s, y + 50 * s], [x + 36 * s, y + 50 * s]]);
}
function sweat(c, x, y) { c.save(); c.strokeStyle = INK; c.lineWidth = 3.5; c.beginPath(); c.moveTo(x, y - 14); c.quadraticCurveTo(x + 10, y + 2, x, y + 8); c.quadraticCurveTo(x - 10, y + 2, x, y - 14); c.stroke(); c.restore(); }
function flash(c, x, y, t) {
  const p = 1 + 0.18 * Math.sin(t * 12);
  c.save(); c.translate(x, y); c.scale(p, p);
  for (let i = 0; i < 6; i++) { const a = i * Math.PI / 3 + 0.3; line(c, [[Math.cos(a) * 22, Math.sin(a) * 22], [Math.cos(a) * 42, Math.sin(a) * 42]], RED, 6); }
  c.restore();
}
function tree(c, x, y) { line(c, [[x, y], [x, y - 70]]); circle(c, x, y - 100, 34, INK, '#fff'); }
function bench(c, x, y) { line(c, [[x - 55, y - 40], [x + 55, y - 40]]); line(c, [[x - 45, y - 40], [x - 45, y]]); line(c, [[x + 45, y - 40], [x + 45, y]]); line(c, [[x - 55, y - 75], [x + 55, y - 75]]); }
function clinic(c, x, y, s = 1) { // 건물 윤곽 (x=중심, y=바닥)
  rr(c, x - 130 * s, y - 190 * s, 260 * s, 190 * s, 6); line(c, [[x - 150 * s, y - 190 * s], [x, y - 250 * s], [x + 150 * s, y - 190 * s]]);
  rr(c, x - 32 * s, y - 100 * s, 64 * s, 100 * s, 4); circle(c, x + 18 * s, y - 50 * s, 3, null, INK);
  line(c, [[x - 95 * s, y - 150 * s], [x - 55 * s, y - 150 * s]], GOLD, 6); line(c, [[x - 75 * s, y - 170 * s], [x - 75 * s, y - 130 * s]], GOLD, 6);
}
function door(c, x, y, h = 230, w = 130) { rr(c, x, y - h, w, h, 6, INK, '#fff'); circle(c, x + w - 20, y - h / 2, 4, null, INK); }
function clipboard(c, x, y) { rr(c, x, y, 46, 60, 5, INK, '#fff', 4); rr(c, x + 12, y - 6, 22, 12, 3, INK, '#fff', 3); line(c, [[x + 10, y + 24], [x + 36, y + 24]], INK, 3); line(c, [[x + 10, y + 38], [x + 36, y + 38]], INK, 3); }
function earIcon(c, x, y, col) { c.save(); c.strokeStyle = col; c.lineWidth = 6; c.lineCap = 'round'; c.beginPath(); c.arc(x, y, 28, Math.PI * 0.9, Math.PI * 2.1); c.stroke(); c.beginPath(); c.arc(x + 4, y + 8, 12, Math.PI * 1.1, Math.PI * 2); c.stroke(); c.restore(); }
function examIcon(c, x, y, col) { rr(c, x - 28, y - 34, 56, 68, 8, col, null, 6); line(c, [[x - 14, y - 6], [x - 4, y + 6], [x + 14, y - 14]], col, 6); }
function talkIcon(c, x, y, col) { rr(c, x - 36, y - 26, 72, 46, 14, col, null, 6); line(c, [[x - 12, y + 20], [x - 22, y + 38], [x + 4, y + 20]], col, 6); }

// ---------- 자막 ----------
function wrap(c, text, maxW) {
  const words = text.split(' '); const lines = []; let cur = '';
  for (const w of words) { const t = cur ? cur + ' ' + w : w; if (c.measureText(t).width > maxW && cur) { lines.push(cur); cur = w; } else cur = t; }
  if (cur) lines.push(cur); return lines;
}
function caption(c, text, alpha = 1) {
  c.save(); c.globalAlpha = alpha; c.textAlign = 'center'; c.textBaseline = 'alphabetic'; c.lineJoin = 'round';
  let size = 54, lines;
  for (; size >= 40; size -= 2) { c.font = `${size}px KR`; lines = wrap(c, text, 1180); if (lines.length <= 2) break; }
  const lh = Math.round(size * 1.3), y0 = 694 - (lines.length - 1) * lh;
  lines.forEach((l, i) => {
    c.lineWidth = 10; c.strokeStyle = '#ffffff'; c.strokeText(l, W / 2, y0 + i * lh);
    c.fillStyle = INK; c.fillText(l, W / 2, y0 + i * lh);
    c.lineWidth = 1.6; c.strokeStyle = INK; c.strokeText(l, W / 2, y0 + i * lh);
  });
  c.restore();
}
function fitText(c, text, maxW, size, x, y, color = INK, bold = false) {
  let s = size; do { c.font = `${bold ? 'bold ' : ''}${s}px KR`; s -= 2; } while (c.measureText(text).width > maxW && s > 20);
  c.fillStyle = color; c.textAlign = 'center'; c.fillText(text, x, y);
}
function drawCard(c, a, notes) {
  c.save(); c.globalAlpha = a; c.fillStyle = '#ffffff'; c.fillRect(0, 0, W, 615);
  rr(c, 50, 20, 1180, 536, 24, GOLD, '#fffdf7', 6);
  const lh = 96, lw = LOGO.width * lh / LOGO.height; c.drawImage(LOGO, W / 2 - lw / 2, 30, lw, lh);
  fitText(c, '천안본정형외과', 1000, 62, W / 2, 186);
  line(c, [[260, 202], [1020, 202]], GOLD, 4);
  fitText(c, '충남 천안시 서북구 불당대로 272 (쌍용동 220-42)', 1100, 38, W / 2, 246, '#333333');
  fitText(c, '전화 041-575-6000', 1000, 54, W / 2, 308, INK, true);
  fitText(c, '평일(월·화·수·금) 09:00-18:00 (점심 13:00-14:00)', 1100, 38, W / 2, 362, '#333333');
  fitText(c, '목요일 09:00-13:00 / 토요일 09:00-12:00', 1100, 38, W / 2, 408, '#333333');
  fitText(c, '일요일·공휴일 휴진', 1100, 38, W / 2, 454, '#333333');
  notes.forEach((n, i) => fitText(c, n, 1100, 28, W / 2, 540 - (notes.length - 1 - i) * 34, '#555555'));
  c.restore();
}

// ---------- 수술 전 준비용 추가 아이콘 ----------
function check(c, x, y, s = 1, col = GOLD, w = 7) { line(c, [[x - 14 * s, y], [x - 4 * s, y + 11 * s], [x + 16 * s, y - 12 * s]], col, w); }
function checklist(c, cx, cy, sc = 1, ticks = [0, 0, 0, 0], alpha = 1, bar = -1, iconA = [0, 0, 0, 0]) {
  c.save(); c.globalAlpha = alpha; c.translate(cx, cy); c.scale(sc, sc);
  rr(c, -120, -160, 240, 320, 18, INK, '#ffffff', 5); rr(c, -36, -176, 72, 24, 8, INK, '#ffffff', 4);
  for (let i = 0; i < 4; i++) {
    const y = -95 + i * 65; rr(c, -88, y - 20, 40, 40, 6, bar === i ? BLUE : INK, null, 5);
    if (iconA[i] < 0.02) line(c, [[-26, y], [84, y]], '#bbbbbb', 6);
    else { c.save(); c.globalAlpha = alpha * iconA[i]; c.translate(30, y); ROW_ICONS[i](c); c.restore(); }
    if (ticks[i] > 0) { c.save(); c.globalAlpha = alpha * ticks[i]; check(c, -68, y, 1.1); c.restore(); }
  }
  c.restore();
}
function pill(c, x, y, ang = 0, s = 1) { c.save(); c.translate(x, y); c.rotate(ang); c.scale(s, s); rr(c, -28, -12, 56, 24, 12, INK, '#ffffff', 4);
  c.save(); c.beginPath(); c.roundRect(-28, -12, 56, 24, 12); c.clip(); c.fillStyle = BLUE; c.fillRect(0, -12, 30, 24); c.restore(); rr(c, -28, -12, 56, 24, 12, INK, null, 4); line(c, [[0, -12], [0, 12]], INK, 3); c.restore(); }
function bag(c, x, y, s = 1) { c.save(); c.translate(x, y); c.scale(s, s); c.strokeStyle = INK; c.lineWidth = 5; c.beginPath(); c.arc(0, -14, 18, Math.PI, 0); c.stroke();
  rr(c, -34, -14, 68, 56, 10, INK, '#ffffff', 5); line(c, [[-12, 14], [12, 14]], BLUE, 6); line(c, [[0, 2], [0, 26]], BLUE, 6); c.restore(); }
function exclaim(c, x, y, s = 1, col = RED, dotDrop = 0) { c.save(); c.translate(x, y); c.scale(s, s); line(c, [[0, -34], [0, 6]], col, 9); circle(c, 0, 24 + dotDrop, 5.5, null, col); c.restore(); }
function clock(c, x, y, ang) { circle(c, x, y, 38, INK, '#ffffff', 5); line(c, [[x, y], [x, y - 24]], INK, 5); line(c, [[x, y], [x + 18 * Math.sin(ang), y - 18 * Math.cos(ang)]], INK, 5); }
function food(c, x, y) { circle(c, x - 22, y, 32, INK, '#ffffff', 5); circle(c, x - 22, y, 17, INK, null, 3); line(c, [[x + 26, y - 30], [x + 26, y + 30]], INK, 4); line(c, [[x + 38, y - 30], [x + 38, y + 30]], INK, 4); line(c, [[x + 50, y - 30], [x + 50, y + 30]], INK, 4); line(c, [[x + 26, y - 4], [x + 50, y - 4]], INK, 4); }
function cup(c, x, y) { line(c, [[x - 26, y - 36], [x - 20, y + 36], [x + 20, y + 36], [x + 26, y - 36], [x - 26, y - 36]], INK, 5); line(c, [[x - 23, y - 8], [x + 23, y - 8]], BLUE, 4); }
function noSign(c, x, y, a = 1, col = RED) { c.save(); c.globalAlpha = a; circle(c, x, y, 62, col, null, 8); line(c, [[x - 44, y - 44], [x + 44, y + 44]], col, 8); c.restore(); }
function paper(c, x, y, s = 1, open = 1) { c.save(); c.translate(x, y); c.scale(s, s); rr(c, -60, -80, 120, 160, 8, INK, '#ffffff', 5); line(c, [[-60 + 12 * (1 - open), -80]], INK, 1); line(c, [[20, -80], [60, -40]], INK, 4); line(c, [[20, -80], [20, -40], [60, -40]], INK, 4);
  for (let i = 0; i < 4; i++) line(c, [[-38, -34 + i * 26], [34, -34 + i * 26]], '#bbbbbb', 5); c.restore(); }
function idCard(c, x, y, s = 1) { c.save(); c.translate(x, y); c.scale(s, s); rr(c, -46, -30, 92, 60, 8, INK, '#ffffff', 5); circle(c, -22, -4, 10, INK, null, 4); line(c, [[0, -10], [34, -10]], '#999999', 4); line(c, [[0, 6], [34, 6]], '#999999', 4); c.restore(); }
function medList(c, x, y, s = 1) { c.save(); c.translate(x, y); c.scale(s, s); rr(c, -32, -42, 64, 84, 6, INK, '#ffffff', 5); pill(c, 0, -14, 0.4, 0.5); line(c, [[-18, 8], [18, 8]], '#999999', 4); line(c, [[-18, 22], [18, 22]], '#999999', 4); c.restore(); }
function shirt(c, x, y, s = 1) { c.save(); c.translate(x, y); c.scale(s, s); line(c, [[-20, -36], [-44, -22], [-34, -6], [-24, -12], [-24, 36], [24, 36], [24, -12], [34, -6], [44, -22], [20, -36], [8, -28], [-8, -28], [-20, -36]], INK, 5); c.restore(); }
function ring(c, x, y) { circle(c, x, y, 14, GOLD, null, 5); line(c, [[x - 6, y - 18], [x, y - 28], [x + 6, y - 18]], GOLD, 5); }
function watchI(c, x, y) { rr(c, x - 10, y - 30, 20, 60, 6, INK, null, 4); circle(c, x, y, 16, INK, '#ffffff', 4); line(c, [[x, y], [x, y - 8]], INK, 3); }

function necklace(c, x, y, s = 1) { c.save(); c.translate(x, y); c.scale(s, s); c.strokeStyle = GOLD; c.lineWidth = 5; c.lineCap = 'round'; c.beginPath(); c.arc(0, -8, 28, 0.15 * Math.PI, 0.85 * Math.PI); c.stroke(); circle(c, 0, 26, 7, GOLD, null, 5); c.restore(); }
function earring(c, x, y, s = 1) { c.save(); c.translate(x, y); c.scale(s, s); circle(c, 0, -14, 9, GOLD, null, 4); line(c, [[0, -5], [0, 12]], GOLD, 4); circle(c, 0, 20, 7, GOLD, '#fbe3a0', 4); c.restore(); }
function xMark(c, x, y, s = 1) { c.save(); c.translate(x, y); c.scale(s, s); line(c, [[-16, -16], [16, 16]], RED, 6); line(c, [[16, -16], [-16, 16]], RED, 6); c.restore(); }
const withS = (c, x, y, s, fn) => { c.save(); c.translate(x, y); c.scale(s, s); fn(c); c.restore(); };
// 체크리스트 각 줄에 들어가는 아이콘 (1 약 / 2 금식 / 3 준비물 / 4 장신구 빼기)
const ROW_ICONS = [
  (c) => { pill(c, -34, 0, 0.3, 0.8); bag(c, 26, 4, 0.5); },
  (c) => { withS(c, -42, 0, 0.5, (k) => clock(k, 0, 0, 2.2)); withS(c, 4, 0, 0.36, (k) => food(k, 0, 0)); withS(c, 46, 0, 0.3, (k) => cup(k, 0, 0)); xMark(c, 8, 0, 0.8); },
  (c) => { idCard(c, -40, 0, 0.5); medList(c, 4, 0, 0.45); shirt(c, 46, 0, 0.5); },
  (c) => { withS(c, -42, 0, 0.8, (k) => ring(k, 0, 6)); necklace(c, 0, 0, 0.5); earring(c, 42, 0, 0.55); line(c, [[-58, 18], [58, -18]], RED, 5); },
];
// 화면 오른쪽 위에 계속 남는 진행 요약 패널
function panel(c, a, ticks, iconA) { if (a > 0) checklist(c, 1140, 200, 0.85, ticks, a, -1, iconA); }

// ---------- 진료 절차 영상용 추가 아이콘 ----------
function phoneI(c, x, y, s = 1) { c.save(); c.translate(x, y); c.scale(s, s); rr(c, -22, -40, 44, 80, 8, INK, '#ffffff', 5); line(c, [[-8, 28], [8, 28]], INK, 4); c.restore(); }
function monitorI(c, x, y, s = 1) { c.save(); c.translate(x, y); c.scale(s, s); rr(c, -46, -32, 92, 60, 6, INK, '#ffffff', 5); line(c, [[0, 28], [0, 42]], INK, 5); line(c, [[-22, 42], [22, 42]], INK, 5); c.restore(); }
function waves(c, x, y, t, col = GOLD) { for (let i = 0; i < 3; i++) { const a = 0.35 + 0.65 * Math.max(0, Math.sin(t * 6 - i * 0.9)); c.save(); c.globalAlpha = a; c.strokeStyle = col; c.lineWidth = 5; c.lineCap = 'round'; c.beginPath(); c.arc(x, y, 18 + i * 14, -0.9, 0.9); c.stroke(); c.restore(); } }
function folderI(c, x, y, s = 1) { c.save(); c.translate(x, y); c.scale(s, s); rr(c, -34, -22, 68, 48, 6, INK, '#fff7e0', 5); line(c, [[-34, -22], [-24, -34], [-6, -34], [2, -22]], INK, 5); c.restore(); }
function discI(c, x, y, s = 1) { c.save(); c.translate(x, y); c.scale(s, s); circle(c, 0, 0, 26, INK, '#ffffff', 5); circle(c, 0, 0, 6, INK, null, 4); c.strokeStyle = BLUE; c.lineWidth = 4; c.beginPath(); c.arc(0, 0, 16, 3.6, 4.8); c.stroke(); c.restore(); }
function probeI(c, x, y, s = 1, ang = 0) { c.save(); c.translate(x, y); c.rotate(ang); c.scale(s, s); rr(c, -11, -44, 22, 62, 9, INK, '#ffffff', 5); line(c, [[0, -44], [0, -64], [18, -76]], INK, 4); c.restore(); }
function tubeI(c, x, y, s = 1) { c.save(); c.translate(x, y); c.scale(s, s); c.fillStyle = RED; c.beginPath(); c.roundRect(-12, 6, 24, 34, [0, 0, 12, 12]); c.fill(); rr(c, -12, -40, 24, 80, [2, 2, 12, 12], INK, null, 5); c.beginPath(); c.moveTo(0, -64); c.quadraticCurveTo(11, -50, 0, -44); c.quadraticCurveTo(-11, -50, 0, -64); c.fillStyle = RED; c.fill(); c.restore(); }
function lampI(c, x, y, s = 1) { c.save(); c.translate(x, y); c.scale(s, s); line(c, [[0, 40], [0, -10]], INK, 5); line(c, [[0, -10], [0, -40]], INK, 5); circle(c, 0, -52, 28, INK, '#ffffff', 5); circle(c, 0, -52, 12, GOLD, null, 4); line(c, [[-30, 40], [30, 40]], INK, 5); c.restore(); }
function xray(c, x, y, w, h, a = 1) { // 영상(엑스레이) 화면: 어두운 바탕 + 뼈 윤곽 + 연골(파랑)
  c.save(); c.globalAlpha = a; c.translate(x, y); rr(c, 0, 0, w, h, 10, INK, '#1d2b3a', 6);
  const cx = w / 2; rr(c, cx - 70, 18, 140, h * 0.34, [0, 0, 30, 30], '#e8eef5', null, 4); rr(c, cx - 70, h - 18 - h * 0.34, 140, h * 0.34, [24, 24, 0, 0], '#e8eef5', null, 4);
  c.fillStyle = BLUE; c.beginPath(); c.roundRect(cx - 62, h * 0.5 - 14, 124, 12, 5); c.fill(); c.beginPath(); c.roundRect(cx - 62, h * 0.5 + 2, 124, 12, 5); c.fill(); c.restore(); }
function sceneGround(c, y = GROUND, x0 = 0, x1 = W) { line(c, [[x0, y], [x1, y]], INK, 4); }
function speech(c, x, y, w, h, tailX, a = 1) { c.save(); c.globalAlpha = a; rr(c, x, y, w, h, 18, INK, '#ffffff', 5); c.fillStyle = '#ffffff'; c.beginPath(); c.moveTo(tailX - 12, y + h - 2); c.lineTo(tailX + 4, y + h + 24); c.lineTo(tailX + 18, y + h - 2); c.fill(); line(c, [[tailX - 12, y + h], [tailX + 4, y + h + 24], [tailX + 18, y + h]], INK, 5); c.restore(); }


// ---------- 입원 절차 영상용 추가 아이콘 ----------
function labelTxt(c, x, y, txt, a = 1, size = 44) { c.save(); c.globalAlpha = a; c.font = `${size}px KR`; c.fillStyle = INK; c.textAlign = 'center'; c.fillText(txt, x, y); c.restore(); }
function insuranceCard(c, x, y, s = 1) { c.save(); c.translate(x, y); c.scale(s, s); rr(c, -46, -30, 92, 60, 8, INK, '#ffffff', 5); line(c, [[-30, -8], [-14, -8]], GOLD, 7); line(c, [[-22, -16], [-22, 0]], GOLD, 7); line(c, [[0, -10], [34, -10]], '#999999', 4); line(c, [[0, 6], [34, 6]], '#999999', 4); c.restore(); }
function referralI(c, x, y, s = 1) { c.save(); c.translate(x, y); c.scale(s, s); rr(c, -34, -42, 68, 84, 6, INK, '#ffffff', 5); line(c, [[-20, -22], [20, -22]], '#999999', 4); line(c, [[-20, -8], [20, -8]], '#999999', 4); line(c, [[-20, 6], [8, 6]], '#999999', 4); line(c, [[6, 26], [26, 26]], GOLD, 6); line(c, [[18, 18], [28, 26], [18, 34]], GOLD, 6); c.restore(); }
function bedI(c, x, y, s = 1, patient = false) { c.save(); c.translate(x, y); c.scale(s, s);
  line(c, [[-90, 0], [90, 0]], INK, 5); line(c, [[-90, 0], [-90, -50]], INK, 5); line(c, [[90, 0], [90, -22]], INK, 5); rr(c, -88, -28, 178, 24, 6, INK, '#fff7e0', 5);
  if (patient) { circle(c, -62, -54, 18, INK, '#ffffff', 5); line(c, [[-44, -44], [60, -38]], INK, 5); line(c, [[60, -38], [84, -34]], INK, 5); }
  c.restore(); }
function deskI(c, x, y, w = 200) { rr(c, x, y - 70, w, 70, 6, INK, '#ffffff', 5); }
function planCard(c, cx, cy, sc, a, ticks) {
  c.save(); c.globalAlpha = a; c.translate(cx, cy); c.scale(sc, sc); rr(c, -130, -150, 260, 300, 18, INK, '#ffffff', 5); rr(c, -40, -166, 80, 24, 8, INK, '#ffffff', 4);
  const icons = [
    (k) => { rr(k, -40, -24, 80, 48, 6, INK, '#1d2b3a', 4); k.fillStyle = BLUE; k.fillRect(-26, -3, 52, 6); line(k, [[-26, -14], [26, -14]], '#e8eef5', 4); line(k, [[-26, 14], [26, 14]], '#e8eef5', 4); },
    (k) => { pill(k, -26, 0, 0.3, 0.8); lampI(k, 28, 14, 0.5); },
    (k) => { withS(k, 0, 40, 0.38, (kk) => figure(kk, 0, 0, { ...STAND, face: 'smile' })); },
  ];
  [0, 1, 2].forEach((i) => { const y = -88 + i * 88; rr(c, -108, y - 24, 48, 48, 8, INK, null, 5); c.save(); c.translate(26, y); icons[i](c); c.restore(); if (ticks[i] > 0) { c.save(); c.globalAlpha = a * ticks[i]; check(c, -84, y, 1.2); c.restore(); } });
  c.restore();
}

// ---------- 장면 ----------
// ---------- 퇴원 절차 영상용 추가 아이콘 ----------
function creditCard(c, x, y, s = 1) { c.save(); c.translate(x, y); c.scale(s, s); rr(c, -46, -30, 92, 60, 8, INK, '#ffffff', 5); c.fillStyle = INK; c.fillRect(-46, -14, 92, 12); rr(c, -34, 8, 26, 16, 3, GOLD, '#fbe3a0', 4); c.restore(); }
function receiptI(c, x, y, s = 1) { c.save(); c.translate(x, y); c.scale(s, s); line(c, [[-30, -42], [30, -42], [30, 42], [20, 36], [10, 42], [0, 36], [-10, 42], [-20, 36], [-30, 42], [-30, -42]], INK, 5); line(c, [[-16, -22], [16, -22]], '#999999', 4); line(c, [[-16, -8], [16, -8]], '#999999', 4); line(c, [[-16, 6], [4, 6]], '#999999', 4); c.restore(); }
function homeI(c, x, y, s = 1) { c.save(); c.translate(x, y); c.scale(s, s); rr(c, -90, -130, 180, 130, 6, INK, '#ffffff', 5); line(c, [[-110, -130], [0, -190], [110, -130]], INK, 5); rr(c, -22, -76, 44, 76, 4, INK, null, 5); rr(c, 40, -100, 36, 36, 3, INK, null, 4); c.restore(); }

// ---------- 병실 생활 안내용 추가 아이콘 ----------
function sunI(c, x, y, s = 1) { c.save(); c.translate(x, y); c.scale(s, s); circle(c, 0, 0, 24, GOLD, '#ffe9a8', 5); for (let i = 0; i < 8; i++) { const a = i * Math.PI / 4; line(c, [[Math.cos(a) * 34, Math.sin(a) * 34], [Math.cos(a) * 48, Math.sin(a) * 48]], GOLD, 5); } c.restore(); }
function moonI(c, x, y, s = 1) { c.save(); c.translate(x, y); c.scale(s, s); circle(c, 0, 0, 30, GOLD, '#ffe9a8', 5); c.fillStyle = '#ffffff'; c.beginPath(); c.arc(16, -8, 28, 0, Math.PI * 2); c.fill(); line(c, [[34, 26], [34, 36]], GOLD, 4); line(c, [[29, 31], [39, 31]], GOLD, 4); c.restore(); }
function trayI(c, x, y, s = 1) { c.save(); c.translate(x, y); c.scale(s, s); rr(c, -64, -4, 128, 22, 8, INK, '#ffffff', 5); c.beginPath(); c.arc(-24, -4, 28, Math.PI, 0); c.strokeStyle = INK; c.lineWidth = 5; c.stroke(); line(c, [[-24, -36], [-24, -44]], GOLD, 5); circle(c, 34, -18, 13, INK, '#ffffff', 5); line(c, [[56, -8], [56, -40]], INK, 4); c.restore(); }
function cigaretteI(c, x, y, s = 1) { c.save(); c.translate(x, y); c.scale(s, s); rr(c, -50, -8, 70, 16, 4, INK, '#ffffff', 5); rr(c, 20, -8, 30, 16, 4, GOLD, '#fbe3a0', 5); c.strokeStyle = '#999999'; c.lineWidth = 4; c.beginPath(); c.moveTo(-40, -16); c.quadraticCurveTo(-30, -30, -40, -42); c.quadraticCurveTo(-50, -54, -40, -64); c.stroke(); c.restore(); }
function glassI(c, x, y, s = 1) { c.save(); c.translate(x, y); c.scale(s, s); line(c, [[-22, -34], [-16, 34], [16, 34], [22, -34], [-22, -34]], INK, 5); c.fillStyle = '#f6c342'; c.beginPath(); c.moveTo(-20, -14); c.lineTo(-15, 32); c.lineTo(15, 32); c.lineTo(20, -14); c.fill(); line(c, [[-22, -34], [22, -34]], INK, 5); c.restore(); }
function speakerI(c, x, y, s = 1) { c.save(); c.translate(x, y); c.scale(s, s); line(c, [[-30, -12], [-14, -12], [8, -30], [8, 30], [-14, 12], [-30, 12], [-30, -12]], INK, 5); c.strokeStyle = INK; c.lineWidth = 5; c.lineCap = 'round'; c.beginPath(); c.arc(8, 0, 20, -0.9, 0.9); c.stroke(); c.beginPath(); c.arc(8, 0, 34, -0.9, 0.9); c.stroke(); c.restore(); }
function showerI(c, x, y, s = 1) { c.save(); c.translate(x, y); c.scale(s, s); c.strokeStyle = INK; c.lineWidth = 6; c.lineCap = 'round'; c.beginPath(); c.arc(0, -20, 34, Math.PI, 0); c.stroke(); line(c, [[-34, -20], [34, -20]], INK, 6); line(c, [[0, -54], [0, -78], [30, -78]], INK, 6); for (let i = -2; i <= 2; i++) line(c, [[i * 14, -8], [i * 14 - 5, 22]], BLUE, 5); c.restore(); }
function slipperI(c, x, y, s = 1) { c.save(); c.translate(x, y); c.scale(s, s); [-34, 34].forEach((dx) => { c.beginPath(); c.ellipse(dx, 0, 28, 14, 0, 0, Math.PI * 2); c.fillStyle = '#ffffff'; c.fill(); c.strokeStyle = INK; c.lineWidth = 5; c.stroke(); for (let k = -2; k <= 2; k++) line(c, [[dx + k * 9, -6], [dx + k * 9, 6]], BLUE, 3); }); c.restore(); }
function lockerI(c, x, y, s = 1) { c.save(); c.translate(x, y); c.scale(s, s); rr(c, -44, -60, 88, 120, 6, INK, '#ffffff', 5); line(c, [[-44, -14], [44, -14]], INK, 4); circle(c, 0, 20, 10, GOLD, null, 5); line(c, [[0, 30], [0, 42]], GOLD, 5); c.restore(); }
function walletI(c, x, y, s = 1) { c.save(); c.translate(x, y); c.scale(s, s); rr(c, -40, -24, 80, 48, 8, INK, '#fff7e0', 5); circle(c, 16, 0, 12, GOLD, '#ffe9a8', 5); line(c, [[-40, -10], [-8, -10]], INK, 4); c.restore(); }
function callBtnI(c, x, y, s = 1, pulse = 0) { c.save(); c.translate(x, y); c.scale(s, s); rr(c, -36, -50, 72, 100, 16, INK, '#ffffff', 5); if (pulse > 0) { c.save(); c.globalAlpha = 0.5 * (1 - pulse); circle(c, 0, -14, 22 + 30 * pulse, RED, null, 5); c.restore(); } circle(c, 0, -14, 18, RED, '#ffb3b0', 5); line(c, [[-12, 24], [12, 24]], '#999999', 4); line(c, [[-12, 36], [12, 36]], '#999999', 4); c.restore(); }
function plusI(c, x, y, s = 1) { line(c, [[x - 11 * s, y], [x + 11 * s, y]], GOLD, 6); line(c, [[x, y - 11 * s], [x, y + 11 * s]], GOLD, 6); }
function nurse(c, x, y, pose, dir = 1) { const f = figure(c, x, y, { ...pose, face: 'smile' }, { dir }); plusI(c, f.head.x, f.head.y - 38, 1); return f; }

// 화면 위 진행 띠: 1~8 항목 번호 + 지금 항목 이름 (지나간 항목은 금색으로 남음)
function drawStrip(c, time, alpha) {
  if (alpha <= 0) return; const labels = ['기상 및 취침', '식사 시간', '병실 내 금지 사항', '개인 위생 관리', '귀중품 관리', '외출 및 외박', '침대 낙상 방지', '응급 상황 대처'];
  c.save(); c.globalAlpha = alpha; let cur = -1;
  labels.forEach((lb, i) => {
    const cx = 440 + 78 * i, cy = 62;
    const done = seg(time, 10 * (i + 2), 10 * (i + 2) + 0.6), act = seg(time, 10 * (i + 1), 10 * (i + 1) + 0.6) * (1 - done);
    if (act > 0.5) cur = i;
    const pulse = 1 + 0.08 * Math.sin(time * 6) * act;
    c.save(); c.translate(cx, cy); c.scale(pulse, pulse);
    circle(c, 0, 0, 24, done > 0.5 || act > 0.5 ? GOLD : '#bbbbbb', done > 0.5 ? GOLD : (act > 0.5 ? '#fff4d6' : '#ffffff'), act > 0.5 ? 7 : 5);
    c.font = 'bold 28px KR'; c.textAlign = 'center'; c.fillStyle = done > 0.5 ? '#ffffff' : (act > 0.5 ? INK : '#aaaaaa'); c.fillText(String(i + 1), 0, 10); c.restore();
  });
  if (cur >= 0) { let s = 30; do { c.font = `${s}px KR`; s -= 2; } while (c.measureText(labels[cur]).width > 270 && s > 18); c.textAlign = 'left'; c.fillStyle = INK; c.fillText(labels[cur], 1030, 73); }
  c.restore();
}

// ---------- 장면 ----------
function S1(c, t) { // 인트로
  sceneGround(c); bedI(c, 820, GROUND, 1.6);
  const wave = seg(t, 2.0, 2.6) * (1 - seg(t, 8.5, 9.2));
  figure(c, 400, GROUND, { ...STAND, armL: { a: lerp(-0.12, 2.6 + 0.3 * Math.sin(t * 11), wave), b: lerp(-0.05, 2.6 + 0.3 * Math.sin(t * 11), wave) }, face: 'smile' });
  const ta = seg(t, 0.6, 1.6); if (ta > 0) { c.save(); c.globalAlpha = ta; c.font = '76px KR'; c.fillStyle = INK; c.textAlign = 'center'; c.fillText('병실 생활 안내', 640, 200); line(c, [[450, 222], [830, 222]], GOLD, 6); c.restore(); }
}

function S2(c, t) { // 1 기상 및 취침
  sceneGround(c);
  const L = seg(t, 0.4, 1.2); if (L > 0) { c.save(); c.globalAlpha = L; sunI(c, 300, 180, 1.3); labelTxt(c, 300, 285, '오전 6:30', 1, 44); c.restore();
    figure(c, 300, GROUND, { ...STAND, armR: { a: lerp(0.12, 2.8, seg(t, 1.0, 1.8)), b: lerp(0.2, 2.8, seg(t, 1.0, 1.8)) }, armL: { a: lerp(-0.12, -2.8, seg(t, 1.0, 1.8)), b: lerp(-0.05, -2.8, seg(t, 1.0, 1.8)) }, face: 'smile' }); }
  const R = seg(t, 2.6, 3.4); if (R > 0) { c.save(); c.globalAlpha = R; moonI(c, 980, 180, 1.3); labelTxt(c, 980, 285, '오후 10:00', 1, 44); bedI(c, 980, GROUND, 1.2, true); c.restore(); }
  const cy = seg(t, 5.4, 6.2); if (cy > 0) { c.save(); c.globalAlpha = cy; c.strokeStyle = GOLD; c.lineWidth = 8; c.lineCap = 'round'; c.beginPath(); c.arc(640, 330, 62, 0.3, 0.3 + Math.PI * 1.6 * cy); c.stroke(); const ea = 0.3 + Math.PI * 1.6 * cy; const ex = 640 + 62 * Math.cos(ea), ey = 330 + 62 * Math.sin(ea); line(c, [[ex - 12, ey - 14], [ex, ey], [ex + 14, ey - 10]], GOLD, 8); c.restore(); }
}

function S3(c, t) { // 2 식사 시간
  sceneGround(c);
  [[0.6, '오전 7:30', 330], [2.6, '낮 12:00', 640], [4.6, '오후 6:00', 950]].forEach(([st, lb, x]) => { const a = seg(t, st, st + 0.7); if (a > 0) { c.save(); c.globalAlpha = a; glow(c, x, 330, 100, '#e8a317', a * 0.4 * (1 - seg(t, st + 0.7, st + 1.7))); trayI(c, x, 330, 1.5); labelTxt(c, x, 440, lb, 1, 46); const ck = seg(t, st + 0.9, st + 1.5); if (ck > 0) { c.globalAlpha = ck; check(c, x + 80, 270, 1.2, GOLD, 9); } c.restore(); } });
  const pl = seg(t, 7.6, 8.4); if (pl > 0) { c.save(); c.globalAlpha = pl; withS(c, 640, 170, 1.8, (k) => { clipboard(k, -23, -30); check(k, 0, 6, 0.9, GOLD, 6); }); c.restore(); }
}

function S4(c, t) { // 3 병실 내 금지 사항
  sceneGround(c);
  [[0.6, cigaretteI, '흡연 금지', 190], [1.8, glassI, '음주 금지', 430], [3.0, speakerI, '소음 자제', 670]].forEach(([st, fn, lb, x]) => { const a = seg(t, st, st + 0.7); if (a > 0) { c.save(); c.globalAlpha = a; fn(c, x, 250, 1.5); noSign(c, x, 250, 1, RED); labelTxt(c, x, 380, lb, 1, 44); c.restore(); } });
  const f = seg(t, 5.0, 5.8); if (f > 0) { c.save(); c.globalAlpha = f; food(c, 940, 250); nurse(c, 1150, GROUND, { ...STAND, armL: { a: -0.5, b: -1.2 } }, -1); check(c, 940, 190, 1.4, GOLD, 10); labelTxt(c, 940, 380, '음식 반입 확인', 1, 40); c.restore(); }
}

function S5(c, t) { // 4 개인 위생 관리
  sceneGround(c);
  const a1 = seg(t, 0.4, 1.2); if (a1 > 0) { c.save(); c.globalAlpha = a1; showerI(c, 280, 270, 1.6); withS(c, 480, 150, 0.9, (k) => calendar(k, 0, 0)); circle(c, 480 + 66 * 0.9, 150 + 92 * 0.9, 12, GOLD, null, 5); nurse(c, 760, GROUND, { ...STAND, armL: { a: -0.5, b: -1.2 } }, -1); clipboard(c, 708, GROUND - 175); labelTxt(c, 280, 420, '샤워·목욕', 1, 42); c.restore(); }
  const a2 = seg(t, 5.0, 5.8); if (a2 > 0) { c.save(); c.globalAlpha = a2; slipperI(c, 1040, 300, 1.4); check(c, 1100, 230, 1.2, GOLD, 9); labelTxt(c, 1040, 400, '미끄럼 방지', 1, 42); c.restore(); }
}

function S6(c, t) { // 5 귀중품 관리
  sceneGround(c);
  lockerI(c, 300, 340, 1.6); labelTxt(c, 300, 500, '보관함', seg(t, 0.4, 1.0), 44);
  const mv = seg(t, 1.0, 3.0), wx = lerp(560, 340, mv); c.save(); c.globalAlpha = 1 - seg(t, 3.0, 3.4); walletI(c, wx, 250, 1.3); c.restore();
  if (t > 3.0) { c.save(); c.globalAlpha = seg(t, 3.0, 3.6); check(c, 360, 190, 1.4, GOLD, 10); c.restore(); }
  const fm = seg(t, 4.8, 5.6); if (fm > 0) { c.save(); c.globalAlpha = fm; figure(c, 900, GROUND, { ...STAND, face: 'smile' }); const wy = 250; walletI(c, 760, wy, 1.0); line(c, [[800, wy], [850, wy]], GOLD, 5); labelTxt(c, 900, 290, '가족', 1, 44); c.restore(); }
  const ex = seg(t, 6.6, 7.4); if (ex > 0) { c.save(); c.globalAlpha = ex; exclaim(c, 1090, 230, 1.6, RED); c.restore(); }
}

function S7(c, t) { // 6 외출 및 외박
  sceneGround(c);
  figure(c, 240, GROUND, { ...STAND, face: 'smile' });
  const d = seg(t, 0.6, 1.4); if (d > 0) { c.save(); c.globalAlpha = d; nurse(c, 520, GROUND, { ...STAND, armL: { a: -0.5, b: -1.2 } }, -1); clipboard(c, 468, GROUND - 175); const ck = seg(t, 1.6, 2.2); c.globalAlpha = ck; check(c, 520, 290, 1.6, GOLD, 10); labelTxt(c, 520, 250, '의사 허가', ck, 40); c.restore(); }
  const ar = seg(t, 2.6, 3.4); if (ar > 0) { c.save(); c.globalAlpha = ar; line(c, [[600, 390], [680, 390]], GOLD, 6); line(c, [[658, 372], [682, 390], [658, 408]], GOLD, 6); figure(c, 760, GROUND, { ...STAND, face: 'smile' }); deskI(c, 650, GROUND, 220); labelTxt(c, 760, 296, '원무과 신청', 1, 40); paper(c, 700, 400, 0.5); c.restore(); }
  const nx = seg(t, 5.8, 6.6); if (nx > 0) { c.save(); c.globalAlpha = nx; door(c, 1050, GROUND, 200, 120); noSign(c, 1110, 440, 1, RED); labelTxt(c, 1110, 320, '무단 외출·외박', 1, 38); c.restore(); }
}

function S8(c, t) { // 7 침대 낙상 방지
  sceneGround(c);
  bedI(c, 420, GROUND, 1.6);
  const rl = seg(t, 1.0, 1.8); if (rl > 0) { c.save(); c.globalAlpha = rl; line(c, [[300, GROUND - 100], [300, GROUND - 160], [540, GROUND - 160], [540, GROUND - 100]], GOLD, 8); c.restore(); labelTxt(c, 420, GROUND - 190, '침대 난간', rl, 40); }
  const k = seg(t, 5.4, 6.2); if (k > 0) { c.save(); c.globalAlpha = k; const f = figure(c, 860, GROUND, { ...STAND, face: 'puzzle', lean: 0.1 }); for (let i = 0; i < 3; i++) { const a = t * 4 + i * 2.09; circle(c, f.head.x + Math.cos(a) * 36, f.head.y - 40 + Math.sin(a) * 8, 4.5, null, GOLD, 1); } callBtnI(c, 1090, 300, 1.3, (t * 1.2) % 1); labelTxt(c, 1090, 430, '호출 버튼', 1, 40); c.restore(); }
  const sl = seg(t, 2.4, 3.2) * (1 - seg(t, 5.0, 5.4)); if (sl > 0) { c.save(); c.globalAlpha = sl; figure(c, 740, GROUND, { ...walkPose(t * 2.5), face: 'smile' }); labelTxt(c, 740, 300, '천천히', 1, 40); c.restore(); }
}

function S9(c, t) { // 8 응급 상황 대처
  sceneGround(c);
  callBtnI(c, 340, 300, 2.0, (t * 1.2) % 1); labelTxt(c, 340, 470, '간호사 호출 버튼', seg(t, 0.4, 1.0), 42);
  const nx = t < 3.0 ? lerp(1400, 780, seg(t, 1.4, 3.0)) : 780;
  if (t > 1.4) nurse(c, nx, GROUND, t < 3.0 ? walkPose(t * 8) : STAND, -1);
  const cl = seg(t, 5.4, 6.2); if (cl > 0) { c.save(); c.globalAlpha = cl; clock(c, 1000, 200, t * 2); labelTxt(c, 1000, 290, '24시간', 1, 44); [900, 1000, 1100].forEach((x) => { withS(c, x, 420, 0.5, (kk) => nurse(kk, 0, 0, STAND, -1)); }); c.restore(); }
}

function S10(c, t) { // 마무리
  sceneGround(c);
  door(c, 200, GROUND, 200);
  const wv = seg(t, 0.6, 1.2) * (1 - seg(t, 4.0, 4.4));
  c.save(); c.globalAlpha = 1 - seg(t, 5.2, 5.8); nurse(c, 400, GROUND, { ...STAND, armL: { a: lerp(-0.12, -2.5 - 0.35 * Math.sin(t * 12), wv), b: lerp(-0.05, -2.5 - 0.35 * Math.sin(t * 12), wv) } }, -1); c.restore();
  glow(c, 265, GROUND - 100, 220, '#e8a317', seg(t, 0.2, 1.0) * (1 - seg(t, 4.5, 5.5)));
  const card = seg(t, 5.2, 6.2); if (card > 0) drawCard(c, card, ['일반 안내이며 개인 상태에 따라 다를 수 있습니다.', '정확한 안내는 김진일 원장님께 확인하세요.']);
}

const CAPS = [
  [[0.4, 4.8, '입원 중 병실 생활 안내입니다.'], [5.0, 9.6, '여덟 가지를 알려 드립니다.']],
  [[0.3, 5.0, '기상은 오전 6시 30분, 취침은 오후 10시입니다.'], [5.2, 9.7, '안정적인 회복을 위해 규칙적인 생활 리듬을 유지해 주세요.']],
  [[0.3, 5.0, '식사는 아침 7시 30분, 점심 12시, 저녁 6시에'], [5.2, 7.4, '병실 또는 식당에서 제공됩니다.'], [7.6, 9.8, '치료 계획에 맞춘 식단이 준비됩니다.']],
  [[0.3, 4.6, '병실 안 흡연과 음주는 엄격히 금지됩니다.'], [4.8, 9.8, '큰 소리는 자제하고, 외부 음식은 간호사에게 먼저 확인해 주세요.']],
  [[0.3, 4.6, '샤워와 목욕은 간호사와 일정을 조율해 진행합니다.'], [4.8, 9.8, '낙상 예방을 위해 욕실에서는 미끄럼 방지 슬리퍼를 신어 주세요.']],
  [[0.3, 4.6, '귀중품과 고액의 현금은 병원 보관함을 이용하거나'], [4.8, 6.4, '가족에게 맡겨 주세요.'], [6.6, 9.8, '분실 시 병원은 책임지지 않으니 주의해 주세요.']],
  [[0.3, 5.6, '외출·외박은 담당 의사의 허가를 받아 원무과에 신청해 주세요.'], [5.8, 9.8, '무단 외출·외박은 치료에 지장을 줄 수 있습니다.']],
  [[0.3, 5.2, '이동할 때는 침대 난간을 올리고, 내려올 때는 천천히 움직여 주세요.'], [5.4, 9.8, '어지러우면 혼자 이동하지 말고 호출 버튼을 눌러 주세요.']],
  [[0.3, 5.0, '응급 상황에는 즉시 간호사 호출 버튼을 눌러 주세요.'], [5.2, 9.7, '24시간 간호 인력이 상주하고 있습니다.']],
  [[0.3, 4.6, '궁금한 점은 병원으로 문의해 주세요.'], [4.8, 9.7, '병실 생활 안내는 개인 상태에 따라 다를 수 있습니다.']],
];

const SCENES = [S1, S2, S3, S4, S5, S6, S7, S8, S9, S10];

function drawFrame0(c, time) {
  const si = Math.min(9, Math.floor(time / 10)), t = time - si * 10;
  c.fillStyle = '#ffffff'; c.fillRect(0, 0, W, H);
  SCENES[si](c, t);
  // 장면 경계 페이드
  const fadeIn = si > 0 ? 1 - seg(t, 0, 0.35) : 0, fadeOut = si < 9 ? seg(t, 9.65, 10) : 0;
  const f = Math.max(fadeIn, fadeOut);
  if (f > 0) { c.save(); c.globalAlpha = f; c.fillStyle = '#ffffff'; c.fillRect(0, 0, W, H); c.restore(); }
  // 진행 띠 (1~4단계)
  { const sa = si === 0 ? seg(t, 3, 4.5) : si === 9 ? 1 - seg(t, 5.2, 6.2) : 1; drawStrip(c, time, sa); }
  // 병원 로고 (왼쪽 위, 안내 카드가 나오면 카드 안 로고로 대체)
  { const la = si === 9 ? 1 - seg(t, 5.2, 6.2) : 1; if (la > 0) { c.save(); c.globalAlpha = la; const lh = 100, lw = LOGO.width * lh / LOGO.height; c.drawImage(LOGO, 28, 12, lw, lh); c.restore(); } }
  // 자막
  for (const [a, b, txt] of CAPS[si]) {
    if (t >= a && t <= b) { const al = Math.min(seg(t, a, a + 0.3), 1 - seg(t, b - 0.3, b)); caption(c, txt, Math.max(al, 0)); }
  }
}

function drawFrame(c, time) { c.save(); c.scale(OW / W, OH / H); drawFrame0(c, time); c.restore(); }

// ---------- 실행 ----------
const args = process.argv.slice(2);
const frameIdx = args.indexOf('--frame');
const canvas = createCanvas(OW, OH), ctx = canvas.getContext('2d');
if (frameIdx >= 0) {
  const secs = args.slice(frameIdx + 1).map(Number);
  for (const s of secs) { drawFrame(ctx, s); fs.writeFileSync(`${process.env.FRAME_DIR || '.'}/frame_${String(s).replace('.', '_')}.png`, canvas.toBuffer('image/png')); }
  console.log('frames saved:', secs.join(', '));
} else {
  const out = args[0] || 'videos/hospital-ward/hospital-ward.mp4';
  fs.mkdirSync(out.split('/').slice(0, -1).join('/') || '.', { recursive: true });
  const ff = spawn(process.env.FFMPEG || 'ffmpeg', ['-y', '-loglevel', 'error', '-f', 'rawvideo', '-pix_fmt', 'rgba', '-s', `${OW}x${OH}`, '-r', String(FPS), '-i', '-',
    '-f', 'lavfi', '-i', 'anullsrc=r=44100:cl=stereo', '-shortest', '-c:v', 'libx264', '-preset', 'medium', '-crf', '17', '-pix_fmt', 'yuv420p', '-c:a', 'aac', '-b:a', '64k', '-movflags', '+faststart', out], { stdio: ['pipe', 'inherit', 'inherit'] });
  const total = FPS * DUR;
  for (let i = 0; i < total; i++) {
    drawFrame(ctx, i / FPS);
    const buf = Buffer.from(canvas.data());
    if (!ff.stdin.write(buf)) await new Promise((r) => ff.stdin.once('drain', r));
  }
  ff.stdin.end();
  await new Promise((res, rej) => ff.on('close', (code) => (code === 0 ? res() : rej(new Error('ffmpeg exit ' + code)))));
  console.log('done:', out);
}
