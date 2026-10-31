// 무릎 수술 전 준비 안내 영상 (본정형외과의원) - 무음 자막 영상 렌더러
// 사용법: node videos/knee-surgery-preop/render.mjs [출력.mp4] [--frame 초] (프레임 PNG만 저장)
// 의존: skills/directing-stickman-videos/node_modules (npm ci), ffmpeg, 한글 글꼴(WenQuanYi Zen Hei)
import { createCanvas, GlobalFonts } from '../../skills/directing-stickman-videos/node_modules/@napi-rs/canvas/index.js';
import { spawn } from 'node:child_process';
import fs from 'node:fs';

const W = 1280, H = 720, FPS = 24, DUR = 60;
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
  c.save(); c.globalAlpha = alpha; c.font = '40px KR'; c.textAlign = 'center'; c.textBaseline = 'alphabetic';
  const lines = wrap(c, text, 1120); const lh = 54; const y0 = 664 - (lines.length - 1) * lh;
  lines.forEach((l, i) => { c.lineWidth = 8; c.strokeStyle = '#ffffff'; c.strokeText(l, W / 2, y0 + i * lh); c.fillStyle = INK; c.fillText(l, W / 2, y0 + i * lh); });
  c.restore();
}

// ---------- 수술 전 준비용 추가 아이콘 ----------
function check(c, x, y, s = 1, col = GOLD, w = 7) { line(c, [[x - 14 * s, y], [x - 4 * s, y + 11 * s], [x + 16 * s, y - 12 * s]], col, w); }
function checklist(c, cx, cy, sc = 1, ticks = [0, 0, 0, 0], alpha = 1, bar = -1) {
  c.save(); c.globalAlpha = alpha; c.translate(cx, cy); c.scale(sc, sc);
  rr(c, -120, -160, 240, 320, 18, INK, '#ffffff', 5); rr(c, -36, -176, 72, 24, 8, INK, '#ffffff', 4);
  for (let i = 0; i < 4; i++) {
    const y = -95 + i * 65; rr(c, -88, y - 20, 40, 40, 6, bar === i ? BLUE : INK, null, 5);
    line(c, [[-26, y], [84, y]], '#bbbbbb', 6);
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

// ---------- 장면 ----------
function sceneGround(c, y = GROUND, x0 = 0, x1 = W) { line(c, [[x0, y], [x1, y]], INK, 4); }
const CARD_END = { x: 640, y: 290, s: 1.1 };

function S1(c, t) { // 수술 날짜가 정해지면
  sceneGround(c);
  const fx = t < 3 ? lerp(-80, 420, seg(t, 0, 3)) : 420;
  const slide = seg(t, 7, 10) * 560;
  calendar(c, 800 + slide, 170);
  const gp = seg(t, 0.4, 1.8); if (gp > 0) { c.save(); c.strokeStyle = GOLD; c.lineWidth = 6; c.lineCap = 'round'; c.beginPath(); c.arc(800 + slide + 28 + 38 * 2, 170 + 62 + 30, 17, -Math.PI / 2, -Math.PI / 2 + Math.PI * 2 * gp); c.stroke(); c.restore(); }
  const scratch = seg(t, 3.2, 3.8) * (1 - seg(t, 6.4, 6.8));
  const pose = t < 3 ? { ...walkPose(t * 8), face: 'flat' } : { ...STAND, armR: { a: lerp(0.12, 2.6 + 0.25 * Math.sin(t * 11), scratch), b: lerp(0.2, 2.9, scratch) }, face: 'puzzle' };
  figure(c, fx, GROUND, pose);
  const up = seg(t, 3.4, 4.4);
  if (up > 0) { c.save(); c.globalAlpha = up * (1 - seg(t, 7, 8)); c.font = 'bold 72px KR'; c.textAlign = 'center'; c.textBaseline = 'middle'; c.strokeStyle = INK; c.lineWidth = 6; c.strokeText('?', fx + 20, 150 - 10 * up); c.restore(); }
  const g = seg(t, 5, 7); const k = seg(t, 7, 10);
  if (up > 0) checklist(c, lerp(fx + 190, CARD_END.x, k), lerp(170, CARD_END.y, k), lerp(0.4, CARD_END.s, k), [0, 0, 0, 0], up);
}

function S2(c, t) { // 당일에 준비하면?
  sceneGround(c);
  const cardA = 1 - seg(t, 7.8, 9.2);
  checklist(c, CARD_END.x, CARD_END.y, CARD_END.s, [0, 0, 0, 0], cardA);
  const wave = seg(t, 2.5, 3.2) * (1 - seg(t, 6.8, 7.4));
  figure(c, 380, GROUND, { ...STAND, armR: { a: lerp(0.12, 1.5 + 0.45 * Math.sin(t * 9), wave), b: lerp(0.2, 1.3 + 0.45 * Math.sin(t * 9), wave) }, face: wave > 0.5 ? 'smile' : 'flat' });
  // 작은 달력 + 날짜 이동 표시
  calendar(c, 960, 120, 150, 130);
  const mv = seg(t, 3.2, 5.2); const mx = lerp(960 + 28 + 38 * 1, 960 + 28 + 38 * 2, mv), my = 120 + 62 + 30;
  circle(c, mx, my, 15, GOLD, null, 5);
  // 느낌표 → 떨어져 알약으로
  const ex = seg(t, 5, 6.2);
  if (t < 7.2 && ex > 0) exclaim(c, 640, lerp(40, 70, ex) , 1.3, RED, 0), c.globalAlpha = 1;
  if (t >= 7.2) {
    const d = (t - 7.2) / 1.6; // 0..1 낙하
    const dropY = lerp(100, 430, clamp(d) * clamp(d)), bounce = t > 8.8 ? Math.abs(Math.sin((t - 8.8) * 7)) * 60 * (1 - seg(t, 8.8, 10)) : 0;
    if (d < 1) { exclaim(c, 640, 80, 1.3 * (1 - seg(t, 7.2, 7.8) * 0.0), RED, 0); circle(c, 640, 80 + 24 * 1.3 + 0, 0.1, null, INK); }
    const px = 640, py = (d < 1 ? dropY : 430 - bounce) - (t > 9.0 ? seg(t, 9.0, 10) * 100 : 0);
    pill(c, px, py, 0.3, 1.5);
  }
}

function S3(c, t) { // 약은 모두 알려 주세요
  sceneGround(c);
  const fx = 330;
  // 알약이 쏟아져 모임 (0~2.2s)
  const pillsA = 1 - seg(t, 2.2, 3.0);
  if (pillsA > 0) for (let i = 0; i < 7; i++) { const st = i * 0.18; const k = clamp((t - st) / 0.9); const x = 500 + (i % 4) * 46 + (i > 3 ? 20 : 0), yEnd = 440 - Math.floor(i / 4) * 26;
    c.save(); c.globalAlpha = pillsA; pill(c, x, lerp(-30, yEnd, k * k), i * 0.7, 1); c.restore(); }
  const hand = figure(c, fx, GROUND, { ...STAND, armR: { a: lerp(0.12, 1.25, seg(t, 2.4, 3.2)), b: lerp(0.2, 1.4, seg(t, 2.4, 3.2)) }, face: 'smile' });
  // 의료진 입장
  const dx = t < 4.4 ? lerp(1450, 930, seg(t, 3.0, 4.4)) : 930;
  const nod = t > 5 && t < 6 ? Math.sin((t - 5) * 12) * 0.05 : 0;
  const doc = figure(c, dx, GROUND, { ...(t < 4.4 ? walkPose(t * 8) : STAND), armL: { a: -0.5, b: -1.2 }, lean: nod, face: 'smile' }, { dir: -1 });
  clipboard(c, dx - 52, GROUND - 195 + 20);
  // 가방 이동: 내 손 → 의료진 손
  const give = seg(t, 4.4, 5.4), bx = lerp(hand.handR.x + 20, doc.handL.x - 10, give), by = lerp(hand.handR.y + 10, doc.handL.y + 10, give);
  const toCard = seg(t, 6.8, 8.2);
  const bagA = t > 2.4 ? 1 : 0;
  const cardA = seg(t, 6.4, 7.4);
  if (cardA > 0) checklist(c, CARD_END.x, CARD_END.y, CARD_END.s, [seg(t, 8.0, 8.5), 0, 0, 0], cardA);
  if (bagA && toCard < 1) { const gx = lerp(bx, CARD_END.x - 88 * CARD_END.s, toCard), gy = lerp(by, CARD_END.y - 95 * CARD_END.s, toCard), sc = lerp(1, 0.4, toCard); c.save(); c.globalAlpha = 1 - seg(t, 7.8, 8.3); bag(c, gx, gy, sc); c.restore();
    // 느낌표 → 금색 체크
    if (t > 4.4 && t < 7.2) { if (t < 5.7) { c.save(); c.globalAlpha = seg(t, 4.4, 4.9); exclaim(c, gx, gy - 70, 0.9, RED); c.restore(); } else { c.save(); c.globalAlpha = seg(t, 5.7, 6.1); check(c, gx, gy - 66, 1.2, GOLD, 8); c.restore(); } } }
}

function S4(c, t) { // 금식·검사 일정
  sceneGround(c);
  const rowOpen = seg(t, 0.3, 1.2), ok = seg(t, 7, 7.8), paperK = seg(t, 8, 10), cardA = 1 - seg(t, 8.6, 9.6);
  checklist(c, CARD_END.x - 120, CARD_END.y, CARD_END.s, [1, ok, 0, 0], cardA, rowOpen > 0.5 && ok < 1 ? 1 : -1);
  const dx = lerp(950, 1500, seg(t, 0, 2.5));
  if (dx < 1450) { c.save(); figure(c, dx, GROUND, { ...walkPose(t * 8), armL: { a: -0.5, b: -1.2 }, face: 'smile' }, { dir: -1 }); c.restore(); }
  const reach = seg(t, 3.2, 4.0) * (1 - seg(t, 6.8, 7.4));
  figure(c, 330, GROUND, { ...STAND, armR: { a: lerp(0.12, 1.45, reach), b: lerp(0.2, 1.5, reach) }, face: reach > 0.5 ? 'flat' : 'smile' });
  const ia = seg(t, 1, 2) * cardA;
  if (ia > 0) { c.save(); c.globalAlpha = ia; clock(c, 900, 190, seg(t, 3, 7) * Math.PI * 4); food(c, 1010, 190 + 150 - 150); cup(c, 1150, 190);
    const nsA = seg(t, 4, 5) * (1 - ok); noSign(c, 1050, 190, nsA); if (ok > 0) { c.globalAlpha = ia * ok; check(c, 1050, 190, 2.2, GOLD, 12); } c.restore(); }
  if (paperK > 0) { c.save(); c.globalAlpha = paperK; paper(c, CARD_END.x - 120 + lerp(0, 120, paperK), lerp(400, 300, paperK), lerp(0.5, 1.4, paperK)); c.restore(); }
}

function S5(c, t) { // 입원 준비물
  sceneGround(c);
  const open = seg(t, 0.2, 1.8), items = seg(t, 1.0, 2.5);
  const fx = t < 7 ? 300 : lerp(300, 760, seg(t, 7.2, 10));
  const bagX = 520, bagY = GROUND - 40;
  const k = [seg(t, 3.0, 4.0), seg(t, 4.0, 5.0), seg(t, 5.0, 6.0)];
  const hold = t >= 6.8;
  const pa = (1 - seg(t, 2.2, 3.0)) * open; if (pa > 0) { c.save(); c.globalAlpha = pa; paper(c, 640, 300, lerp(1.4, 1.1, open)); c.restore(); }
  const slots = [[430, 190], [640, 190], [850, 190]], fns = [idCard, medList, shirt];
  fns.forEach((fn, i) => { const sx = lerp(640, slots[i][0], items), sy = lerp(300, slots[i][1], items); const px = lerp(sx, bagX, k[i]), py = lerp(sy, bagY - 40, k[i]); const a = items * (1 - k[i] * 0.0) * (k[i] < 1 ? 1 : 0); if (a > 0) { c.save(); c.globalAlpha = a; fn(c, px, py, lerp(1.2, 0.6, k[i])); c.restore(); } });
  const pose = hold ? { ...walkPose(t * 8), face: 'smile' } : { ...STAND, armR: { a: 0.7 + 0.3 * Math.sin(t * 5), b: 0.9 }, face: 'smile' };
  const f = figure(c, fx, GROUND, pose);
  if (!hold) bag(c, bagX, bagY, 1); else bag(c, f.handR.x + 14, f.handR.y + 10, 1);
  const ra = seg(t, 5.2, 6.2); if (ra > 0 && !hold) { c.save(); c.globalAlpha = ra; ring(c, 640, GROUND - 22); watchI(c, 700, GROUND - 32); c.restore(); }
  if (hold) { c.save(); c.globalAlpha = 1 - seg(t, 7.2, 8.0); ring(c, 640, GROUND - 22); watchI(c, 700, GROUND - 32); c.restore(); }
}

function S6(c, t) { // 마무리: 병원 문
  sceneGround(c);
  const dx = 980; c.save(); c.globalAlpha = seg(t, 0, 1.2); door(c, dx, GROUND); c.restore();
  const wx = t < 2.6 ? lerp(100, 780, seg(t, 0, 2.6)) : (t < 4.2 ? 780 : lerp(780, 1010, seg(t, 4.2, 5.0)));
  const pose = t < 2.6 || t >= 4.2 ? { ...walkPose(t * 8), face: 'smile' } : { ...STAND, face: 'smile' };
  c.save(); c.globalAlpha = t > 4.6 ? 1 - seg(t, 4.6, 5.0) : 1; const f = figure(c, wx, GROUND, pose); bag(c, f.handR.x + 14, f.handR.y + 10, 0.9); c.restore();
  // 의료진 마중
  const waving = seg(t, 2.8, 3.2) * (1 - seg(t, 4.0, 4.3)); const da = seg(t, 1.5, 2.4);
  c.save(); c.globalAlpha = da * (1 - seg(t, 5.2, 5.8)); figure(c, 900, GROUND, { ...STAND, armL: { a: lerp(-0.12, -2.5 - 0.35 * Math.sin(t * 12), waving), b: lerp(-0.05, -2.5 - 0.35 * Math.sin(t * 12), waving) }, face: 'smile' }, { dir: -1 }); c.restore();
  glow(c, dx + 65, GROUND - 115, 260, '#e8a317', seg(t, 4.4, 5.2) * (1 - seg(t, 6.5, 8)));
  const card = seg(t, 5.2, 6.2);
  if (card > 0) {
    c.save(); c.globalAlpha = card; c.fillStyle = '#ffffff'; c.fillRect(0, 0, W, 615);
    rr(c, 150, 70, 980, 500, 24, GOLD, '#fffdf7', 6);
    c.textAlign = 'center'; c.fillStyle = INK; c.font = '56px KR'; c.fillText('본정형외과의원', W / 2, 150);
    line(c, [[260, 175], [1020, 175]], GOLD, 4);
    const rows = ['충남 천안시 서북구 불당대로 272 (쌍용동 220-42)', '전화 041-575-6000', '평일(월·화·수·금) 09:00-18:00 (점심 13:00-14:00)', '목요일 09:00-13:00 / 토요일 09:00-12:00', '일요일·공휴일 휴진'];
    rows.forEach((r, i) => { c.fillStyle = i === 1 ? INK : '#333333'; c.font = i === 1 ? 'bold 44px KR' : '34px KR'; c.fillText(r, W / 2, 238 + i * 62 + (i > 1 ? 10 : 0)); });
    c.font = '24px KR'; c.fillStyle = '#666666'; c.fillText('일반 안내이며 개인 상태에 따라 다를 수 있습니다.', W / 2, 528); c.fillText('정확한 안내는 담당 의료진에게 확인하세요.', W / 2, 558);
    c.restore();
  }
}

const CAPS = [
  [[0.5, 8.7, '수술 날짜가 정해지면 무엇을 준비해야 할지 막막하시죠?']],
  [[0.3, 9.6, '당일에 준비하면 된다고 생각하기 쉽지만, 미리 확인할 것이 있습니다.']],
  [[0.3, 3.8, '드시는 약은 모두 알려 주세요.'], [4.0, 9.7, '약에 따라 조정이 필요할 수 있어, 임의로 끊거나 계속 드시지 마세요.']],
  [[0.3, 9.6, '금식 시간과 검사 일정은 안내문에 적힌 대로 꼭 지켜 주세요.']],
  [[0.3, 9.6, '신분증과 복용 약 목록, 편한 옷을 챙기고, 장신구는 빼고 오세요.']],
  [[0.3, 4.0, '궁금한 점은 병원으로 문의해 주세요.'], [4.2, 9.7, '개인 상태에 따라 다를 수 있으니 담당 의료진의 안내를 따라 주세요.']],
];

const SCENES = [S1, S2, S3, S4, S5, S6];

function drawFrame(c, time) {
  const si = Math.min(5, Math.floor(time / 10)), t = time - si * 10;
  c.fillStyle = '#ffffff'; c.fillRect(0, 0, W, H);
  SCENES[si](c, t);
  // 장면 경계 페이드
  const fadeIn = si > 0 ? 1 - seg(t, 0, 0.35) : 0, fadeOut = si < 5 ? seg(t, 9.65, 10) : 0;
  const f = Math.max(fadeIn, fadeOut);
  if (f > 0) { c.save(); c.globalAlpha = f; c.fillStyle = '#ffffff'; c.fillRect(0, 0, W, H); c.restore(); }
  // 자막
  for (const [a, b, txt] of CAPS[si]) {
    if (t >= a && t <= b) { const al = Math.min(seg(t, a, a + 0.3), 1 - seg(t, b - 0.3, b)); caption(c, txt, Math.max(al, 0)); }
  }
}

// ---------- 실행 ----------
const args = process.argv.slice(2);
const frameIdx = args.indexOf('--frame');
const canvas = createCanvas(W, H), ctx = canvas.getContext('2d');
if (frameIdx >= 0) {
  const secs = args.slice(frameIdx + 1).map(Number);
  for (const s of secs) { drawFrame(ctx, s); fs.writeFileSync(`${process.env.FRAME_DIR || '.'}/frame_${String(s).replace('.', '_')}.png`, canvas.toBuffer('image/png')); }
  console.log('frames saved:', secs.join(', '));
} else {
  const out = args[0] || 'videos/knee-surgery-preop/knee-surgery-preop.mp4';
  fs.mkdirSync(out.split('/').slice(0, -1).join('/') || '.', { recursive: true });
  const ff = spawn(process.env.FFMPEG || 'ffmpeg', ['-y', '-loglevel', 'error', '-f', 'rawvideo', '-pix_fmt', 'rgba', '-s', `${W}x${H}`, '-r', String(FPS), '-i', '-',
    '-f', 'lavfi', '-i', 'anullsrc=r=44100:cl=stereo', '-shortest', '-c:v', 'libx264', '-preset', 'medium', '-crf', '20', '-pix_fmt', 'yuv420p', '-c:a', 'aac', '-b:a', '64k', '-movflags', '+faststart', out], { stdio: ['pipe', 'inherit', 'inherit'] });
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
