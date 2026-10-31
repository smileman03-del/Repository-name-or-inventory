// 무릎 관절염 안내 영상 (본정형외과의원) - 무음 자막 영상 렌더러
// 사용법: node videos/knee-arthritis/render.mjs [출력.mp4] [--frame 초] (프레임 PNG만 저장)
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
const CAPS = [
  [[0.5, 8.7, '계단을 오르내릴 때 무릎이 시큰거리신 적 있으신가요?']],
  [[0.3, 4.8, '나이 탓이라며 참고 지내는 분들이 많습니다.'], [5.0, 9.7, '하지만 원인은 다양할 수 있습니다.']],
  [[0.3, 4.8, '무릎 뼈 끝에는 충격을 줄여 주는 연골이 있습니다.'], [5.0, 9.7, '연골이 닳거나 손상되면 관절염으로 이어질 수 있습니다.']],
  [[0.3, 9.6, '병원에서는 먼저 증상을 듣고, 진찰과 검사로 상태를 살펴본 뒤 치료 방향을 함께 상의합니다.']],
  [[0.3, 9.6, '무리한 계단 사용은 줄이고, 가벼운 걷기와 스트레칭으로 무릎 주변 근육을 관리해 보세요.']],
  [[0.3, 4.0, '증상이 계속된다면 의료진과 상담해 보세요.'], [4.2, 9.7, '증상과 경과는 사람마다 다를 수 있습니다.']],
];

// ---------- 장면 ----------
function sceneGround(c, y = GROUND, x0 = 0, x1 = W) { line(c, [[x0, y], [x1, y]], INK, 4); }

function S1(c, t) { // 계단 앞에서 무릎 통증
  const stopT = 3, kz = seg(t, 7, 10);
  const wx = t < stopT ? lerp(-80, 640, seg(t, 0, stopT)) : 640;
  const wince = seg(t, 3, 3.7);
  let pose, f;
  const phase = t * 8;
  if (t < stopT) { pose = { ...walkPose(phase), face: 'flat' }; }
  else {
    pose = { lean: 0.28 * wince, legR: { a: lerp(0.08, 0.7, wince), b: lerp(0.08, -0.1, wince) }, legL: { a: -0.08, b: -0.08 },
      armR: { a: lerp(0.12, 0.95, wince), b: lerp(0.2, 0.75, wince) }, armL: { a: lerp(-0.12, 0.8, wince), b: lerp(-0.05, 0.7, wince) }, face: 'wince' };
  }
  // 줌: 무릎 중심
  const kneeGuess = { x: 640 + 34, y: GROUND - 95 + 36 };
  const s = lerp(1, 2.3, kz), ox = kz * (W / 2 - kneeGuess.x * s), oy = kz * (300 - kneeGuess.y * s);
  c.save(); c.translate(ox, oy); c.scale(s, s);
  sceneGround(c, GROUND, -300, 2000); stairs(c, 780, GROUND, 1);
  f = figure(c, wx, GROUND, pose);
  if (t >= stopT) { flash(c, f.knee.x + 30, f.knee.y - 18, t); if (t > 3.3) sweat(c, f.head.x - 36, f.head.y - 24); }
  c.restore();
}

function S2(c, t) { // 통념 깨기
  const x = 380;
  sceneGround(c);
  // 달력 페이지 넘김 (0~3.4s)
  calendar(c, 760, 200);
  if (t < 3.4) { const k = (t * 3.2) % 1; c.save(); c.translate(760, 200); c.scale(1 - 2 * Math.abs(k - 0.5) * 0.0 + 0, 1);
    c.restore(); const sw = Math.cos(k * Math.PI); c.save(); c.translate(845, 275); c.scale(Math.max(0.05, Math.abs(sw)), 1); rr(c, -85, -75, 170, 150, 10, INK, '#fff'); c.restore(); }
  const a = seg(t, 3, 3.6); if (a > 0) { c.save(); c.globalAlpha = a; hourglass(c, 1090, 330, 1); c.restore(); }
  const shrug = seg(t, 3.5, 4.2) * (1 - seg(t, 6.5, 7));
  const pose = { ...STAND, armR: { a: lerp(0.12, 1.6, shrug), b: lerp(0.2, 1.1, shrug) }, armL: { a: lerp(-0.12, -1.6, shrug), b: lerp(-0.05, -1.1, shrug) }, face: shrug > 0.3 ? 'flat' : 'puzzle' };
  figure(c, x, GROUND, pose);
  // 물음표
  const q = seg(t, 4.5, 10);
  if (q > 0) { c.save(); c.font = `bold ${lerp(70, 1000, q * q)}px KR`; c.textAlign = 'center'; c.textBaseline = 'middle';
    c.globalAlpha = lerp(1, 0.18, seg(t, 8, 10)); c.strokeStyle = INK; c.lineWidth = 6; c.strokeText('?', lerp(380, 640, q), lerp(250, 330, q)); c.restore(); }
}

function S3(c, t) { // 연골 도해
  const fade = seg(t, 0, 1.2), pan = seg(t, 7, 10) * 40;
  c.save(); c.translate(0, -pan);
  c.save(); c.globalAlpha = fade;
  // 대퇴골(위) / 경골(아래)
  rr(c, 640, 90, 330, 190, [0, 0, 70, 70], INK, '#fff'); rr(c, 640, 380, 330, 210, [40, 40, 0, 0], INK, '#fff');
  // 연골(파랑)
  const worn = seg(t, 4.5, 7); // 닳는 정도
  c.fillStyle = BLUE;
  c.beginPath(); c.roundRect(660, 284, 290, 38, 14); c.fill();
  c.beginPath(); c.roundRect(660, 340, 290, 38, 14); c.fill();
  c.save(); c.fillStyle = '#ffffff'; c.beginPath(); c.ellipse(805, 284, 46, 4 + 18 * worn, 0, 0, Math.PI * 2); c.fill(); c.restore();
  c.save(); c.fillStyle = '#ffffff'; c.beginPath(); c.ellipse(805, 378, 46, 4 + 16 * worn, 0, 0, Math.PI * 2); c.fill(); c.restore();
  // 충격 흡수 화살표
  const pulse = 0.5 + 0.5 * Math.sin(t * 5);
  c.globalAlpha = fade * (0.45 + 0.4 * pulse); line(c, [[700, 232], [700, 276]], BLUE, 5); line(c, [[690, 266], [700, 278], [710, 266]], BLUE, 5);
  line(c, [[920, 232], [920, 276]], BLUE, 5); line(c, [[910, 266], [920, 278], [930, 266]], BLUE, 5);
  c.restore();
  c.save(); c.globalAlpha = fade; c.font = '34px KR'; c.fillStyle = BLUE; c.textAlign = 'left'; c.fillText('무릎 연골', 985, 332); c.restore();
  // 스틱맨 + 돋보기
  const m = seg(t, 2.5, 3.6);
  const pose = { ...STAND, armR: { a: lerp(0.12, 1.25, m), b: lerp(0.2, 1.45, m) }, face: 'smile' };
  const f = figure(c, 330, GROUND, pose);
  if (m > 0) { const hx = f.handR.x, hy = f.handR.y; c.save(); c.globalAlpha = m; circle(c, hx + 22, hy - 4, 24, INK, 'rgba(74,144,217,0.12)', 5); line(c, [[hx + 4, hy + 10], [hx - 12, hy + 26]], INK, 6); c.restore(); }
  c.restore();
}

function S4(c, t) { // 병원 → 진찰·검사·설명
  sceneGround(c);
  const outside = seg(t, 3.0, 3.6);
  if (outside < 1) {
    c.save(); c.globalAlpha = 1 - outside;
    clinic(c, 860, GROUND, 1.2); const gl = seg(t, 1.5, 3); glow(c, 860, GROUND - 55, 130, '#e8a317', gl);
    const wx = lerp(120, 770, seg(t, 0, 2.8)); figure(c, wx, GROUND, { ...walkPose(t * 8), face: 'smile' });
    c.restore();
  }
  if (outside > 0) {
    c.save(); c.globalAlpha = outside;
    rr(c, 120, 120, 1040, 440, 12, INK, null, 4);
    figure(c, 420, GROUND - 10, { ...STAND, face: 'smile' });
    figure(c, 860, GROUND - 10, { ...STAND, legR: { a: 0.05, b: 0.05 }, armL: { a: -0.4, b: -1.0 }, face: 'smile' }, { dir: -1 });
    clipboard(c, 800, 372);
    const t1 = seg(t, 3.6, 4.4), t2 = seg(t, 5.0, 5.8), t3 = seg(t, 6.4, 7.2), row = seg(t, 7.4, 8.6);
    const ys = lerp(215, 215, row), xs = [lerp(500, 440, row), 640, lerp(780, 840, row)];
    [[earIcon, t1], [examIcon, t2], [talkIcon, t3]].forEach(([fn, k], i) => {
      c.save(); c.globalAlpha = 0.25 + 0.75 * k; const sc = 1 + 0.12 * Math.sin(k * Math.PI);
      c.translate(xs[i], ys); c.scale(sc, sc); fn(c, 0, 0, k > 0.5 ? GOLD : '#bbbbbb'); c.restore();
    });
    c.restore();
  }
}

function S5(c, t) { // 산책·스트레칭
  const walk1 = t < 3.2, stretch = seg(t, 3.2, 4) * (1 - seg(t, 6.3, 7));
  const slope = seg(t, 7, 7.6);
  // 배경 스크롤
  const scroll = t < 7 ? t * 140 : 7 * 140 + (t - 7) * 140;
  sceneGround(c, GROUND, 0, 760 + 520 * (1 - slope));
  if (slope > 0) { const yEnd = lerp(GROUND, 440, slope); line(c, [[760, GROUND], [1280, yEnd]], INK, 4); }
  const benchX = lerp(900, 640, seg(t, 0, 3.2));
  for (let i = -1; i < 7; i++) { const x = ((i * 330 - scroll * 0.6) % 2310 + 2310) % 2310 - 200; if (t < 7 && Math.abs(x - benchX) < 120) continue; tree(c, x, GROUND); }
  if (t < 7) bench(c, benchX, GROUND);
  // 인물
  let pose, fy = GROUND, fx = 420;
  if (t < 3.2) pose = { ...walkPose(t * 8), face: 'smile' };
  else if (t < 7) { // 허벅지 스트레칭: 오른발을 뒤로 들어 손으로 잡기
    pose = { legR: { a: lerp(0.08, -0.15, stretch), b: lerp(0.08, -2.0, stretch) }, legL: { a: -0.02, b: -0.02 },
      armR: { a: lerp(0.12, -0.9, stretch), b: lerp(0.2, -1.7, stretch) }, armL: { a: lerp(-0.12, -0.6, stretch), b: -0.3 }, face: 'smile' };
  } else { pose = { ...walkPose(t * 8), face: 'smile' }; }
  if (t >= 7) { const k = seg(t, 7.4, 10); fx = lerp(420, 700, k); fy = lerp(GROUND, 490, seg(t, 8, 10) * 0.8); }
  const f = figure(c, fx, fy, pose);
  if (stretch > 0.5 && t < 7) { c.save(); c.globalAlpha = 0.5 + 0.5 * Math.sin(t * 8); line(c, [[f.knee.x - 78, f.knee.y - 60], [f.knee.x - 78, f.knee.y - 40]], GOLD, 5); line(c, [[f.knee.x - 88, f.knee.y - 50], [f.knee.x - 68, f.knee.y - 50]], GOLD, 5); c.restore(); }
  if (t >= 6.5) { c.save(); c.globalAlpha = seg(t, 6.5, 7) * (1 - seg(t, 8, 9)); stairs(c, 1000, GROUND, 0.7, '#999999'); c.restore(); }
}

function S6(c, t) { // 병원 문 앞 → 안내 카드
  sceneGround(c);
  const dx = 980;
  const doorA = seg(t, 0, 1.2); c.save(); c.globalAlpha = doorA; door(c, dx, GROUND); c.restore();
  const wx = t < 2.6 ? lerp(100, 800, seg(t, 0, 2.6)) : (t < 4.2 ? 800 : lerp(800, 1010, seg(t, 4.2, 5.0)));
  const waving = seg(t, 2.8, 3.2) * (1 - seg(t, 4.0, 4.3));
  let pose;
  if (t < 2.6) pose = { ...walkPose(t * 8), face: 'smile' };
  else if (t < 4.2) pose = { ...STAND, armR: { a: lerp(0.12, 2.5 + 0.35 * Math.sin(t * 12), waving), b: lerp(0.2, 2.5 + 0.35 * Math.sin(t * 12), waving) }, face: 'smile' };
  else pose = { ...walkPose(t * 8), face: 'smile' };
  c.save(); c.globalAlpha = t > 4.6 ? 1 - seg(t, 4.6, 5.0) : 1; figure(c, wx, GROUND, pose); c.restore();
  glow(c, dx + 65, GROUND - 115, 260, '#e8a317', seg(t, 4.4, 5.2) * (1 - seg(t, 6.5, 8)));
  // 안내 카드 (5s~)
  const card = seg(t, 5.2, 6.2);
  if (card > 0) {
    c.save(); c.globalAlpha = card; c.fillStyle = '#ffffff'; c.fillRect(0, 0, W, 615); // 장면 정리
    rr(c, 150, 70, 980, 500, 24, GOLD, '#fffdf7', 6);
    c.textAlign = 'center'; c.fillStyle = INK; c.font = '56px KR'; c.fillText('본정형외과의원', W / 2, 150);
    line(c, [[260, 175], [1020, 175]], GOLD, 4);
    c.font = '34px KR';
    const rows = ['충남 천안시 서북구 불당대로 272 (쌍용동 220-42)', '전화 041-575-6000', '평일(월·화·수·금) 09:00-18:00 (점심 13:00-14:00)', '목요일 09:00-13:00 / 토요일 09:00-12:00', '일요일·공휴일 휴진'];
    rows.forEach((r, i) => { c.fillStyle = i === 1 ? INK : '#333333'; c.font = i === 1 ? 'bold 44px KR' : '34px KR'; c.fillText(r, W / 2, 238 + i * 62 + (i > 1 ? 10 : 0)); });
    c.font = '26px KR'; c.fillStyle = '#666666'; c.fillText('일반 건강 정보 영상이며 개인에 따라 증상과 경과는 다를 수 있습니다.', W / 2, 548);
    c.restore();
  }
}

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
  const out = args[0] || 'videos/knee-arthritis/knee-arthritis.mp4';
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
