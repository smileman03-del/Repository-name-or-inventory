// 진료 절차 안내 영상 (천안본정형외과) - 무음 자막 영상 렌더러
// 사용법: node videos/hospital-guide/render.mjs [출력.mp4] [--frame 초] (프레임 PNG만 저장)
// 의존: skills/directing-stickman-videos/node_modules (npm ci), ffmpeg, 한글 글꼴(WenQuanYi Zen Hei)
import { createCanvas, GlobalFonts, loadImage } from '../../skills/directing-stickman-videos/node_modules/@napi-rs/canvas/index.js';
import { spawn } from 'node:child_process';
import fs from 'node:fs';

const W = 1280, H = 720, FPS = 24, DUR = 60;
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

// 화면 위 진행 띠: 1 상담 예약 → 2 초진 상담 → 3 정밀 진단 → 4 치료 시작 (지나간 단계는 금색으로 남음)
function drawStrip(c, time, alpha) {
  if (alpha <= 0) return; const labels = ['상담 예약', '초진 상담', '정밀 진단', '치료 시작'];
  c.save(); c.globalAlpha = alpha;
  labels.forEach((lb, i) => {
    const cx = 490 + 200 * i, cy = 62;
    const done = seg(time, 10 * (i + 2), 10 * (i + 2) + 0.6), act = seg(time, 10 * (i + 1), 10 * (i + 1) + 0.6) * (1 - done);
    const pulse = 1 + 0.08 * Math.sin(time * 6) * act;
    c.save(); c.translate(cx, cy); c.scale(pulse, pulse);
    circle(c, 0, 0, 27, done > 0.5 ? GOLD : (act > 0.5 ? GOLD : '#bbbbbb'), done > 0.5 ? GOLD : (act > 0.5 ? '#fff4d6' : '#ffffff'), act > 0.5 ? 7 : 5);
    c.font = 'bold 34px KR'; c.textAlign = 'center'; c.fillStyle = done > 0.5 ? '#ffffff' : (act > 0.5 ? INK : '#aaaaaa'); c.fillText(String(i + 1), 0, 12); c.restore();
    c.font = '28px KR'; c.textAlign = 'left'; c.fillStyle = (done > 0.5 || act > 0.5) ? INK : '#999999'; c.fillText(lb, cx + 38, cy + 10);
  });
  c.restore();
}

// ---------- 장면 ----------
function S1(c, t) { // 인트로
  sceneGround(c);
  clinic(c, 930, GROUND, 1.2); glow(c, 930, GROUND - 55, 140, '#e8a317', seg(t, 1, 3));
  const wx = t < 4 ? lerp(-80, 560, seg(t, 0, 4)) : 560;
  const wave = seg(t, 4.2, 4.8) * (1 - seg(t, 8.5, 9.2));
  const pose = t < 4 ? { ...walkPose(t * 8), face: 'smile' } : { ...STAND, armR: { a: lerp(0.12, 2.6 + 0.3 * Math.sin(t * 11), wave), b: lerp(0.2, 2.6 + 0.3 * Math.sin(t * 11), wave) }, face: 'smile' };
  figure(c, wx, GROUND, pose);
  const ta = seg(t, 3.4, 4.4); if (ta > 0) { c.save(); c.globalAlpha = ta; c.font = '76px KR'; c.fillStyle = INK; c.textAlign = 'center'; c.fillText('진료 절차 4단계', 640, 200); line(c, [[430, 222], [850, 222]], GOLD, 6); c.restore(); }
}

function S2(c, t) { // 1 상담 예약: 재진 환자는 전화 예약 가능 / 초진 환자는 전화 예약 불가
  sceneGround(c);
  const tag = (x, txt, a) => { c.save(); c.globalAlpha = a; c.font = '46px KR'; c.fillStyle = INK; c.textAlign = 'center'; c.fillText(txt, x, 296); c.restore(); };
  // 재진 환자: 전화 + 금색 체크
  const up1 = seg(t, 0.2, 0.9);
  const h1 = figure(c, 260, GROUND, { ...STAND, armR: { a: lerp(0.12, 1.2, up1), b: lerp(0.2, 2.2, up1) }, face: 'smile' });
  c.save(); c.globalAlpha = up1; phoneI(c, h1.handR.x + 14, h1.handR.y - 30, 1); c.restore();
  tag(260, '재진 환자', seg(t, 0.2, 0.8));
  if (t < 2.9) waves(c, h1.handR.x + 40, h1.handR.y - 40, t);
  const ok1 = seg(t, 1.4, 2.0); if (ok1 > 0) { c.save(); c.globalAlpha = ok1; check(c, h1.handR.x + 74, h1.handR.y - 104, 1.3, GOLD, 10); c.restore(); }
  // 초진 환자: 전화 + 빨강 금지 표시
  const a2 = seg(t, 3.0, 3.6);
  if (a2 > 0) {
    const up2 = seg(t, 3.2, 3.9);
    const h2 = figure(c, 640, GROUND, { ...STAND, armR: { a: lerp(0.12, 1.2, up2), b: lerp(0.2, 2.2, up2) }, face: seg(t, 4.2, 4.8) > 0.5 ? 'puzzle' : 'smile' });
    c.save(); c.globalAlpha = a2; phoneI(c, h2.handR.x + 14, h2.handR.y - 30, 1); c.restore();
    tag(640, '초진 환자', a2);
    const nk = seg(t, 4.0, 4.6); if (nk > 0) { c.save(); c.globalAlpha = nk; withS(c, h2.handR.x + 14, h2.handR.y - 30, 0.75, (k) => noSign(k, 0, 0, 1)); c.restore(); }
    // 증상을 미리 알림 → 대기 시간 감소, 검사 안내
    const bub = seg(t, 5.6, 6.2) * (1 - seg(t, 7.4, 7.8));
    if (bub > 0) { speech(c, 540, 110, 190, 110, 620, bub); c.save(); c.globalAlpha = bub; flash(c, 635, 168, t); sweat(c, 692, 150); c.restore(); }
  }
  const hg = seg(t, 7.2, 7.8); if (hg > 0) { c.save(); c.globalAlpha = hg; hourglass(c, 960, 270, lerp(1.8, 1.0, seg(t, 7.4, 9.4))); line(c, [[1060, 230], [1060, 300]], GOLD, 7); line(c, [[1040, 282], [1060, 306], [1080, 282]], GOLD, 7); c.restore(); }
  const cb = seg(t, 8.4, 9.0); if (cb > 0) { c.save(); c.globalAlpha = cb; clipboard(c, 1120, 230); check(c, 1143, 262, 0.9, GOLD, 7); c.restore(); }
}

function S3(c, t) { // 2 초진 상담
  sceneGround(c);
  figure(c, 400, GROUND, { ...STAND, face: 'smile' });
  const doc = figure(c, 880, GROUND, { ...STAND, armL: { a: -0.5, b: -1.2 }, face: 'smile' }, { dir: -1 }); clipboard(c, 828, GROUND - 175);
  const icons = [[0.8, (x, y) => { flash(c, x, y, t); }], [2.4, (x, y) => { withS(c, x - 55, y - 48, 0.64, (k) => calendar(k, 0, 0)); }], [4.2, (x, y) => { stairs(c, x - 60, y + 50, 0.5); }]];
  icons.forEach(([st, fn], i) => { const a = seg(t, st, st + 0.7); if (a > 0) { c.save(); c.globalAlpha = a; const x = 330 + i * 230, y = 210; glow(c, x, y, 90, '#e8a317', a * 0.6); fn(x, y); c.restore(); } });
  const mg = seg(t, 6.2, 7.2); if (mg > 0) { c.save(); c.globalAlpha = mg; line(c, [[330, 300], [560, 330]], GOLD, 5); line(c, [[560, 300], [560, 330]], GOLD, 5); line(c, [[790, 300], [560, 330]], GOLD, 5); circle(c, 560, 360, 34, INK, 'rgba(232,163,23,0.15)', 6); line(c, [[584, 384], [610, 410]], INK, 9); check(c, 560, 360, 0.9, GOLD, 8); c.restore(); }
}

function S4(c, t) { // 3 정밀 진단
  sceneGround(c);
  figure(c, 280, GROUND, { ...STAND, face: 'smile' });
  const xa = seg(t, 0.5, 1.5); xray(c, 560, 150, 320, 230, xa);
  const pr = seg(t, 3.6, 4.4) * (1 - seg(t, 6.4, 6.8)); if (pr > 0) { c.save(); c.globalAlpha = pr; const sw = Math.sin(t * 5) * 14; probeI(c, 420 + sw, 380, 1, 0.6); waves(c, 440 + sw, 420, t); c.restore(); }
  const tb = seg(t, 5.0, 5.8) * (1 - seg(t, 6.6, 7.0)); if (tb > 0) { c.save(); c.globalAlpha = tb; tubeI(c, 470, 250, 1.1); c.restore(); }
  const dx = t < 6.2 ? lerp(1500, 1040, seg(t, 5.2, 6.2)) : 1040;
  if (t > 5.2) { const point = seg(t, 6.6, 7.4); figure(c, dx, GROUND, { ...(t < 6.2 ? walkPose(t * 8) : STAND), armL: { a: lerp(-0.5, -1.7, point), b: lerp(-1.2, -1.9, point) }, face: 'smile' }, { dir: -1 }); clipboard(c, dx - 52, GROUND - 175); }
  if (t > 7.0) { c.save(); c.globalAlpha = seg(t, 7.0, 7.8); glow(c, 720, 265, 160, '#e8a317', 0.5); check(c, 720, 265, 1.6, GOLD, 10); c.restore(); }
}

function S5(c, t) { // 4 치료 시작
  sceneGround(c);
  const k = seg(t, 5.2, 6.3), s = lerp(1, 0.72, k), cy = lerp(330, 200, k);
  const card = (cx, title, icon) => { c.save(); c.translate(cx, cy); c.scale(s, s); rr(c, -200, -130, 400, 260, 22, INK, '#ffffff', 6); icon(c); c.font = '46px KR'; c.fillStyle = INK; c.textAlign = 'center'; c.fillText(title, 0, 104); c.restore(); };
  const ca = seg(t, 0.4, 1.4); if (ca > 0) { c.save(); c.globalAlpha = ca; card(400, '수술적 치료', (cc) => lampI(cc, 0, -10, 1.3)); card(880, '비수술적 치료', (cc) => withS(cc, 0, 52, 0.7, (kk) => figure(kk, 0, 0, { ...walkPose(t * 6), face: 'smile' }))); c.restore(); }
  if (t >= 5.2) { const f = seg(t, 6.0, 7.0); const fx = lerp(180, 960, seg(t, 6.2, 9.8)), ph = t * 7;
    [300, 560, 820].forEach((x, i) => { const a = f * (fx > x ? 1 : 0.35); c.save(); c.globalAlpha = a; line(c, [[x, GROUND], [x, GROUND - 90]], INK, 5); c.fillStyle = GOLD; c.beginPath(); c.moveTo(x, GROUND - 90); c.lineTo(x + 46, GROUND - 74); c.lineTo(x, GROUND - 58); c.fill(); c.restore(); });
    c.save(); c.globalAlpha = f; figure(c, fx, GROUND, { ...walkPose(ph), face: 'smile' }); figure(c, fx + 90, GROUND, { ...walkPose(ph + 0.4), face: 'smile' }); clipboard(c, fx + 120, GROUND - 175); c.restore(); }
}

function S6(c, t) { // 서류·CD 접수 → 안내 카드
  sceneGround(c);
  const staff = figure(c, 940, GROUND, { ...STAND, face: 'smile' }, { dir: -1 });
  rr(c, 780, GROUND - 86, 300, 86, 6, INK, '#ffffff', 5);
  const wx = t < 3 ? lerp(120, 560, seg(t, 0, 3)) : 560;
  const give = seg(t, 3.0, 3.8);
  const me = figure(c, wx, GROUND, { ...(t < 3 ? walkPose(t * 8) : STAND), armR: { a: lerp(0.5, 1.4, give), b: lerp(0.6, 1.5, give) }, face: 'smile' });
  const ix = lerp(me.handR.x + 20, 830, give), iy = lerp(me.handR.y - 6, GROUND - 120, give);
  folderI(c, ix, iy, 1); discI(c, ix + 56, iy + 6, 0.9);
  const card = seg(t, 5.2, 6.2); if (card > 0) drawCard(c, card, ['일반 안내이며 개인 상태에 따라 다를 수 있습니다.', '정확한 안내는 김진일 원장님께 확인하세요.']);
}

const CAPS = [
  [[0.4, 4.8, '처음 오셨나요? 진료 절차를 안내해 드립니다.'], [5.0, 9.6, '진료는 네 단계로 진행됩니다.']],
  [[0.3, 2.9, '재진 환자는 전화로 예약하실 수 있습니다.'], [3.0, 5.4, '초진 환자분은 전화 예약이 안 됩니다.'], [5.6, 9.8, '예약 시 증상을 미리 알려 주시면 대기 시간을 줄이고, 필요한 검사도 미리 안내해 드립니다.']],
  [[0.3, 4.6, '원장님이 증상과 통증이 시작된 시점,'], [4.8, 9.7, '생활 습관까지 자세히 살펴 원인을 함께 찾아갑니다.']],
  [[0.3, 3.4, '진단 장비로 통증의 원인을 살펴보고,'], [3.6, 6.4, '필요하면 초음파·혈액 검사를 함께 합니다.'], [6.6, 9.8, '결과는 영상 자료와 함께 쉽게 설명해 드립니다.']],
  [[0.3, 5.2, '진단 결과에 따라 수술적·비수술적 치료 계획을 함께 세우고,'], [5.4, 9.7, '회복 단계까지 원장님이 함께합니다.']],
  [[0.3, 4.6, '서류나 영상 CD를 가져오신 분은 접수할 때 제출해 주세요.'], [4.8, 9.7, '상담 문의는 041-575-6000으로 연락해 주세요.']],
];

const SCENES = [S1, S2, S3, S4, S5, S6];

function drawFrame0(c, time) {
  const si = Math.min(5, Math.floor(time / 10)), t = time - si * 10;
  c.fillStyle = '#ffffff'; c.fillRect(0, 0, W, H);
  SCENES[si](c, t);
  // 장면 경계 페이드
  const fadeIn = si > 0 ? 1 - seg(t, 0, 0.35) : 0, fadeOut = si < 5 ? seg(t, 9.65, 10) : 0;
  const f = Math.max(fadeIn, fadeOut);
  if (f > 0) { c.save(); c.globalAlpha = f; c.fillStyle = '#ffffff'; c.fillRect(0, 0, W, H); c.restore(); }
  // 진행 띠 (1~4단계)
  { const sa = si === 0 ? seg(t, 3, 4.5) : si === 5 ? 1 - seg(t, 5.2, 6.2) : 1; drawStrip(c, time, sa); }
  // 병원 로고 (왼쪽 위, 안내 카드가 나오면 카드 안 로고로 대체)
  { const la = si === 5 ? 1 - seg(t, 5.2, 6.2) : 1; if (la > 0) { c.save(); c.globalAlpha = la; const lh = 100, lw = LOGO.width * lh / LOGO.height; c.drawImage(LOGO, 28, 12, lw, lh); c.restore(); } }
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
  const out = args[0] || 'videos/hospital-guide/hospital-guide.mp4';
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
