import math, subprocess, sys, wave
import numpy as np
from PIL import Image, ImageDraw, ImageFont, ImageFilter

W, H, FPS, DUR = 1280, 720, 30, 45
# usage: make_video.py OUT.mp4 BGM.wav [PHOTO.jpg]
#   PHOTO is optional: with it, a 9 s "story" scene on that photo is inserted after the intro.
OUT, WAV = sys.argv[1], sys.argv[2]
PHOTO_PATH = sys.argv[3] if len(sys.argv) > 3 else None
SLEEP0 = 31.0 if PHOTO_PATH else 28.0   # music gets softer from here (sleep scene)
FONT = "/usr/share/fonts/truetype/wqy/wqy-zenhei.ttc"
ZFONT = "/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf"

# ---------------- music: calm pad + music-box arpeggio, 45 s ----------------
SR = 44100
N = SR * DUR
t = np.arange(N) / SR


def midi(m):
    return 440.0 * 2 ** ((m - 69) / 12)


prog = [[48, 52, 55, 59], [45, 52, 55, 60], [41, 48, 52, 57], [43, 50, 55, 59]]  # Cmaj7 Am7 Fmaj7 G6
chords = prog * 2 + [prog[0]]
seg = DUR / len(chords)
pad = np.zeros(N)
for i, ch in enumerate(chords):
    s0, s1 = i * seg - 0.7, (i + 1) * seg + 0.7
    env = (np.clip((t - s0) / 1.4, 0, 1) * np.clip((s1 - t) / 1.4, 0, 1)) ** 1.5
    for m in ch:
        f = midi(m)
        pad += env * (np.sin(2 * np.pi * f * t) + 0.25 * np.sin(2 * np.pi * 2 * f * t)
                      + 0.12 * np.sin(2 * np.pi * f * 1.003 * t))
pad *= 0.06

rng0 = np.random.default_rng(7)
arp = np.zeros(N)
step = 0.625
pattern = [0, 1, 2, 3, 2, 1]
for k in range(int(DUR / step)):
    if rng0.random() < 0.2:
        continue
    ch = chords[min(int(k * step / seg), len(chords) - 1)]
    f = midi(ch[pattern[k % 6]] + 24)
    st = int(k * step * SR)
    seg_t = np.arange(min(int(1.6 * SR), N - st)) / SR
    note = np.exp(-seg_t * 3.2) * (np.sin(2 * np.pi * f * seg_t) + 0.3 * np.sin(2 * np.pi * 2 * f * seg_t))
    note *= np.clip(seg_t / 0.005, 0, 1)
    arp[st:st + len(note)] += note * 0.07

# softer during the sleep scene (29-38 s)
soft = 1 - 0.35 * np.clip((t - SLEEP0) / 1.5, 0, 1) * np.clip((SLEEP0 + 9.0 - t) / 1.5, 0, 1)
music = (pad + arp * soft) * soft
rev = music.copy()
for d_, g in [(0.11, 0.35), (0.19, 0.28), (0.31, 0.2), (0.47, 0.12)]:
    o = int(d_ * SR)
    rev[o:] += g * music[:-o]
music = rev * np.clip(t / 0.8, 0, 1) * np.clip((DUR - t) / 2.2, 0, 1)
music = music / np.max(np.abs(music)) * 0.45
stereo = np.stack([music, np.roll(music, 40)], axis=1)
with wave.open(WAV, "wb") as w:
    w.setnchannels(2); w.setsampwidth(2); w.setframerate(SR)
    w.writeframes((stereo * 32767).astype("<i2").tobytes())

# ---------------- character (plush baby T-rex), 2 eye states ----------------
S, CH, ANCH = 1000, 500, 466
G, GD, BELLY, OR = (126, 205, 142), (70, 150, 98), (255, 241, 205), (255, 196, 130)


def make_char(eyes):
    C = Image.new("RGBA", (S, S), (0, 0, 0, 0))
    d = ImageDraw.Draw(C)

    def ell(box, fill, ol=GD, w=8):
        x0, y0, x1, y1 = box
        d.ellipse((x0 - w, y0 - w, x1 + w, y1 + w), fill=ol)
        d.ellipse(box, fill=fill)

    for i in range(9):
        f = i / 8
        cx = 330 - 230 * f; cy = 720 - 170 * f - 60 * math.sin(f * math.pi)
        r = 95 - 60 * f
        ell((cx - r, cy - r, cx + r, cy + r), G)
    ell((290, 430, 730, 880), G)
    ell((370, 520, 650, 850), BELLY, ol=(235, 215, 170), w=5)
    for y in range(560, 820, 34):
        d.line((506, y, 514, y + 14), fill=(200, 170, 120), width=5)
    ell((320, 800, 490, 925), G); ell((530, 800, 700, 925), G)
    for bx in (350, 410, 455, 560, 620, 665):
        d.ellipse((bx - 14, 895, bx + 14, 925), fill=BELLY)
    ell((250, 600, 340, 680), G); ell((680, 600, 770, 680), G)
    for (cx, cy, r) in [(250, 480, 38), (275, 410, 34), (320, 360, 30)]:
        ell((cx - r, cy - r, cx + r, cy + r), OR, ol=(214, 140, 80), w=6)
    ell((200, 110, 800, 610), G)
    for (cx, cy, r) in [(410, 120, 36), (500, 98, 42), (590, 120, 36)]:
        ell((cx - r, cy - r, cx + r, cy + r), OR, ol=(214, 140, 80), w=6)
    ell((200, 110, 800, 610), G)
    ell((350, 360, 650, 580), (150, 218, 163), ol=GD, w=6)
    for ex in (355, 645):
        if eyes == "open":
            d.ellipse((ex - 62, 285, ex + 62, 425), fill=(40, 30, 40))
            d.ellipse((ex - 32, 305, ex + 6, 345), fill=(255, 255, 255))
            d.ellipse((ex + 8, 372, ex + 30, 394), fill=(255, 255, 255))
        else:
            d.arc((ex - 60, 300, ex + 60, 390), 15, 165, fill=(40, 30, 40), width=14)
    cheek = Image.new("RGBA", (S, S), (0, 0, 0, 0))
    cd = ImageDraw.Draw(cheek)
    for cx in (290, 710):
        cd.ellipse((cx - 55, 430, cx + 55, 495), fill=(255, 150, 165, 200))
    C = Image.alpha_composite(C, cheek)
    d = ImageDraw.Draw(C)
    d.ellipse((455, 420, 480, 450), fill=GD); d.ellipse((520, 420, 545, 450), fill=GD)
    d.arc((440, 450, 560, 540), 20, 160, fill=(60, 80, 70), width=8)
    d.polygon([(468, 508), (486, 508), (477, 530)], fill=(255, 255, 255))
    d.polygon([(514, 508), (532, 508), (523, 530)], fill=(255, 255, 255))
    return C.resize((CH, CH), Image.LANCZOS)


CHARS = {"open": make_char("open"), "closed": make_char("closed")}


def put_char(fr, state, x, feet_y, scale=1.0, sx=1.0, sy=1.0, rot=0.0, alpha=1.0, sticker=False):
    im = CHARS[state]
    if rot:
        im = im.rotate(rot, resample=Image.BICUBIC, center=(CH / 2, ANCH))
    w, h = int(CH * scale * sx), int(CH * scale * sy)
    im = im.resize((w, h), Image.BICUBIC)
    pos = (int(x - w / 2), int(feet_y - ANCH * scale * sy))
    if sticker:
        m = im.getchannel("A").filter(ImageFilter.MaxFilter(11))
        if alpha < 1:
            m = m.point(lambda v: int(v * alpha))
        fr.paste(Image.new("RGB", im.size, (255, 252, 245)), pos, m)
    if alpha < 1:
        im = im.copy(); im.putalpha(im.getchannel("A").point(lambda v: int(v * alpha)))
    fr.paste(im, pos, im)


# ---------------- helpers ----------------
FT = {n: ImageFont.truetype(FONT, s) for n, s in
      [("title", 84), ("big", 118), ("sub", 38), ("tag", 30), ("cta", 54), ("night", 76), ("story", 36)]}
ZF = {s: ImageFont.truetype(ZFONT, s) for s in (38, 52, 68)}


def ease(x):
    x = max(0.0, min(1.0, x))
    return x * x * (3 - 2 * x)


def grad(top, bot):
    a = np.linspace(0, 1, H)[:, None]
    g = np.array(top)[None, :] * (1 - a) + np.array(bot)[None, :] * a
    return Image.fromarray(np.repeat(g[:, None, :], W, axis=1).astype("uint8"), "RGB")


def put_text(fr, txt, font, color, x, y, t0, tt, dur=1.0, rise=14, abs_a=1.0):
    a = ease((tt - t0) / dur) * abs_a
    if a <= 0:
        return
    l, tp, r, b = font.getbbox(txt)
    w, h = r - l + 20, b - tp + 20
    lay = Image.new("L", (w, h), 0)
    ImageDraw.Draw(lay).text((10 - l, 10 - tp), txt, font=font, fill=int(255 * a))
    fr.paste(Image.new("RGB", (w, h), color), (int(x + l - 10), int(y + tp - 10 + rise * (1 - a))), lay)


def shadow(fr, x, y, hw, alpha, color=(120, 80, 50)):
    lay = Image.new("L", (int(hw * 2 + 60), 100), 0)
    ImageDraw.Draw(lay).ellipse((30, 32, 30 + hw * 2, 68), fill=int(alpha))
    lay = lay.filter(ImageFilter.GaussianBlur(8))
    fr.paste(Image.new("RGB", lay.size, color), (int(x - hw - 30), int(y - 50)), lay)


def heart(d, cx, cy, s, fill):
    d.ellipse((cx - s, cy - s, cx, cy), fill=fill)
    d.ellipse((cx, cy - s, cx + s, cy), fill=fill)
    d.polygon([(cx - s, cy - s * 0.35), (cx + s, cy - s * 0.35), (cx, cy + s * 1.1)], fill=fill)


def star4(d, cx, cy, r, fill):
    k = r * 0.28
    d.polygon([(cx, cy - r), (cx + k, cy - k), (cx + r, cy), (cx + k, cy + k),
               (cx, cy + r), (cx - k, cy + k), (cx - r, cy), (cx - k, cy - k)], fill=fill)


rng = np.random.default_rng(3)
bubbles = [(rng.uniform(0, W), rng.uniform(0, H), rng.uniform(20, 70), rng.uniform(0.3, 1.0)) for _ in range(12)]
stars = [(rng.uniform(0, W), rng.uniform(0, 420), rng.uniform(1.5, 3.5), rng.uniform(0, 6.28)) for _ in range(46)]
conf = [(rng.uniform(0, W), rng.uniform(0, H), rng.uniform(8, 16), rng.uniform(0.5, 1.2), rng.uniform(0, 6.28),
         [(255, 170, 185), (255, 210, 110), (150, 210, 165), (150, 195, 240)][i % 4]) for i in range(30)]

BG = {"warm": grad((255, 247, 232), (255, 224, 196)), "mint": grad((236, 250, 240), (205, 238, 218)),
      "sky": grad((165, 218, 250), (228, 246, 255)), "night": grad((28, 34, 76), (74, 66, 122))}


def blink(t):
    return "closed" if (t % 3.4) > 3.22 else "open"


def draw_bubbles(ov, t, col=(255, 255, 255, 70)):
    od = ImageDraw.Draw(ov)
    for (bx, by, br, sp) in bubbles:
        y = (by - t * 18 * sp) % (H + 140) - 70
        od.ellipse((bx - br, y - br, bx + br, y + br), fill=col)


def finish(fr, ov):
    fr.paste(ov, (0, 0), ov)


# ---------------- scenes (each returns an RGB frame; t is scene-local) ----------------
def scene0(t):
    fr = BG["warm"].copy()
    ov = Image.new("RGBA", (W, H), (0, 0, 0, 0)); draw_bubbles(ov, t); finish(fr, ov)
    rise = (1 - ease(t / 1.2)) * 60
    bob = 10 * math.sin(t * 2 * math.pi / 2.5)
    if rise < 55:
        shadow(fr, 1010, 640, 200 - bob * 2, 60 * ease(t / 0.8))
    part = Image.new("RGB", (W, H))
    put_char(fr, blink(t), 1010, 581 + bob + rise, rot=3 * math.sin(t * 2 * math.pi / 3.3))
    c = (92, 58, 38); c2 = (130, 96, 72)
    put_text(fr, "아기 티라노 인형", FT["title"], c, 90, 215, 0.4, t, 1.6, 18)
    put_text(fr, "포근하고 말랑한 우리 아이의", FT["sub"], c2, 90, 350, 3.0, t)
    put_text(fr, "첫 공룡 친구", FT["sub"], c2, 90, 402, 3.3, t)
    put_text(fr, "포근한 촉감 · 귀여운 얼굴", FT["tag"], (86, 160, 110), 90, 485, 5.0, t)
    return fr


def scene1(t):
    fr = BG["mint"].copy()
    ov = Image.new("RGBA", (W, H), (0, 0, 0, 0)); draw_bubbles(ov, t, (255, 255, 255, 90))
    od = ImageDraw.Draw(ov)
    for k in range(30):
        age = t - 0.6 - k * 0.45
        if 0 <= age < 2.4:
            x = 1010 + 150 * math.sin(k * 2.1) + 18 * math.sin(age * 3)
            y = 170 - 120 * age
            heart(od, x, y + 200, 16 + 8 * math.sin(k), (255, 140, 165, int(210 * (1 - age / 2.4))))
    finish(fr, ov)
    sq = math.sin(2 * math.pi * t / 1.8)
    shadow(fr, 1010, 640, 200 + 10 * sq, 60)
    put_char(fr, blink(t), 1010, 581, sx=1 + 0.07 * sq, sy=1 - 0.09 * sq)
    c = (52, 96, 70); c2 = (84, 116, 96)
    put_text(fr, "말랑말랑", FT["big"], (232, 110, 140), 90, 175, 0.5, t, 1.2, 20)
    put_text(fr, "안으면 폭 안기는", FT["sub"], c2, 90, 350, 2.0, t)
    put_text(fr, "포근한 촉감", FT["sub"], c2, 90, 402, 2.3, t)
    put_text(fr, "아이 품에 쏙 들어와요", FT["tag"], (70, 150, 100), 90, 485, 4.0, t)
    return fr


def scene2(t):
    fr = BG["sky"].copy()
    ov = Image.new("RGBA", (W, H), (0, 0, 0, 0)); od = ImageDraw.Draw(ov)
    for (bx, by, sp, sc) in [(100, 90, 22, 1.0), (620, 180, 15, 0.8), (1000, 60, 28, 1.2), (400, 300, 18, 0.7)]:
        x = (bx + t * sp) % (W + 400) - 200
        for (dx, dy, r) in [(0, 0, 38), (45, -14, 46), (95, 0, 36), (45, 12, 40)]:
            od.ellipse((x + dx * sc - r * sc, by + dy * sc - r * sc, x + dx * sc + r * sc, by + dy * sc + r * sc),
                       fill=(255, 255, 255, 230))
    od.ellipse((-200, 610, 700, 1000), fill=(160, 215, 150, 255))
    od.ellipse((400, 590, 1500, 1050), fill=(140, 205, 135, 255))
    for fx, fy, col in [(120, 650, (255, 170, 185)), (300, 680, (255, 215, 110)), (780, 660, (255, 170, 185)),
                        (1150, 670, (255, 215, 110)), (560, 700, (255, 255, 255))]:
        od.ellipse((fx - 9, fy - 9, fx + 9, fy + 9), fill=col + (255,))
    finish(fr, ov)
    u = (t % 1.6) / 1.6
    hgt = 150 * 4 * u * (1 - u)
    s = max(0.0, 1 - min(u, 1 - u) / 0.1)
    sc = 0.85
    ground = 640
    shadow(fr, 990, ground + 5, (170 * (1 - hgt / 420)) * sc, 70 * (1 - hgt / 300), (60, 110, 60))
    put_char(fr, blink(t), 990, ground - hgt, scale=sc, sx=1 + 0.1 * s, sy=1 - 0.14 * s,
             rot=4 * math.sin(2 * math.pi * u))
    c = (46, 78, 112)
    put_text(fr, "어디든 함께", FT["big"], (60, 120, 180), 90, 150, 0.4, t, 1.2, 20)
    put_text(fr, "나들이도, 여행도", FT["sub"], c, 90, 330, 1.8, t)
    put_text(fr, "언제나 곁에서", FT["sub"], c, 90, 382, 2.1, t)
    return fr


def scene3(t):
    fr = BG["night"].copy()
    ov = Image.new("RGBA", (W, H), (0, 0, 0, 0)); od = ImageDraw.Draw(ov)
    for (sx_, sy_, r, ph) in stars:
        rr = r * (0.7 + 0.3 * math.sin(t * 2 + ph))
        od.ellipse((sx_ - rr, sy_ - rr, sx_ + rr, sy_ + rr), fill=(255, 250, 225, 230))
    od.ellipse((125, 60, 215, 150), fill=(255, 240, 190, 255))
    od.ellipse((150, 48, 240, 138), fill=(38, 42, 88, 255))
    finish(fr, ov)
    br = math.sin(2 * math.pi * t / 3.5)
    shadow(fr, 1010, 640, 200, 90, (8, 8, 30))
    put_char(fr, "closed", 1010, 581, sx=1 - 0.012 * br, sy=1 + 0.02 * br)
    for k in range(10):
        age = t - 1.0 - k * 1.6
        if 0 <= age < 3.2:
            f = ZF[(38, 52, 68)[k % 3]]
            a = math.sin(math.pi * age / 3.2)
            put_text(fr, "Z", f, (255, 240, 210), 830 + 15 * (k % 3) - age * 6, 205 - age * 30, 0, 99, 0.1, 0, a)
    put_text(fr, "포근한 잠자리 친구", FT["night"], (255, 240, 210), 90, 215, 0.6, t, 1.4, 18)
    put_text(fr, "오늘 밤도 쿨쿨", FT["sub"], (205, 200, 235), 90, 340, 2.4, t)
    return fr


def scene4(t):
    fr = BG["warm"].copy()
    ov = Image.new("RGBA", (W, H), (0, 0, 0, 0)); draw_bubbles(ov, t); od = ImageDraw.Draw(ov)
    for (cx, cy, r, sp, ph, col) in conf:
        y = (cy + t * 45 * sp) % (H + 60) - 30
        star4(od, cx + 20 * math.sin(t * 1.5 + ph), y, r * (0.7 + 0.3 * math.sin(t * 3 + ph)), col + (210,))
    finish(fr, ov)
    hop = 16 * abs(math.sin(2 * math.pi * t / 1.5))
    shadow(fr, 1010, 640, 200 - hop * 3, 60)
    put_char(fr, blink(t), 1010, 581 - hop, rot=3 * math.sin(2 * math.pi * t / 1.5))
    put_text(fr, "아기 티라노 인형", FT["title"], (92, 58, 38), 90, 190, 0.4, t, 1.4, 18)
    put_text(fr, "우리 아이의 첫 공룡 친구", FT["sub"], (130, 96, 72), 90, 320, 1.8, t)
    put_text(fr, "지금 만나보세요", FT["cta"], (70, 150, 100), 90, 420, 3.2, t, 1.2, 16)
    return fr


PHOTO = Image.open(PHOTO_PATH).convert("RGB") if PHOTO_PATH else None
PW, PH = PHOTO.size if PHOTO else (1, 1)


def sceneW(t):
    z = 1.12 + 0.06 * (t / 9)
    s_ = (H / PH) * z
    w_, h_ = W / s_, H / s_
    x0 = (PW - w_) * 0.1
    fr = PHOTO.resize((W, H), Image.BILINEAR, box=(x0, 0, x0 + w_, h_))
    ov = Image.new("RGBA", (W, H), (0, 0, 0, 0))
    ImageDraw.Draw(ov).rounded_rectangle((36, 46, 470, 316), radius=26, fill=(18, 24, 20, int(125 * ease(t / 0.8))))
    finish(fr, ov)
    for i, (ln, t0) in enumerate([("아주 먼 옛날,", 0.8), ("커다란 티라노 곁에", 1.8),
                                  ("작은 아기 티라노가", 3.0), ("태어났어요", 4.0)]):
        put_text(fr, ln, FT["story"], (255, 248, 232), 66, 72 + i * 58, t0, t, 0.9, 12)
    ba = ease((t - 2.0) / 1.0)
    if ba > 0:
        hop = 10 * abs(math.sin(2 * math.pi * t / 1.6))
        shadow(fr, 250, 706, 100, 100 * ba, (10, 20, 10))
        put_char(fr, blink(t), 250, 700 - hop, scale=0.6, rot=2 * math.sin(2 * math.pi * t / 1.6), alpha=ba, sticker=True)
    return fr


if PHOTO:
    SCENES = [scene0, sceneW, scene1, scene2, scene3, scene4]
    BOUNDS = [0, 7, 16, 24, 32, 39, 45]
else:
    SCENES = [scene0, scene1, scene2, scene3, scene4]
    BOUNDS = [0, 9, 19, 29, 38, 45]
XF = 0.4


def frame_at(tt):
    for k in range(1, len(SCENES)):
        if abs(tt - BOUNDS[k]) < XF:
            a = ease((tt - (BOUNDS[k] - XF)) / (2 * XF))
            f0 = SCENES[k - 1](tt - BOUNDS[k - 1])
            f1 = SCENES[k](max(0.0, tt - BOUNDS[k]))
            fr = Image.blend(f0, f1, a)
            break
    else:
        i = max(j for j in range(len(SCENES)) if tt >= BOUNDS[j] - 1e-9)
        fr = SCENES[i](tt - BOUNDS[i])
    fo = ease((tt - 43.4) / 1.6)
    if fo > 0:
        fr = Image.blend(fr, Image.new("RGB", (W, H), (255, 247, 232)), fo * 0.95)
    return fr


ff = subprocess.Popen(
    ["ffmpeg", "-y", "-loglevel", "error", "-f", "rawvideo", "-pix_fmt", "rgb24", "-s", f"{W}x{H}",
     "-r", str(FPS), "-i", "-", "-i", WAV, "-c:v", "libx264", "-pix_fmt", "yuv420p", "-crf", "18",
     "-c:a", "aac", "-b:a", "160k", "-shortest", OUT], stdin=subprocess.PIPE)
for n in range(FPS * DUR):
    ff.stdin.write(frame_at(n / FPS).tobytes())
ff.stdin.close()
ff.wait()
print("done", ff.returncode)
