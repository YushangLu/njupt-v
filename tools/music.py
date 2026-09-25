"""Procedural soundtrack for the NJUPT animation.

Everything is synthesised from scratch with numpy/scipy (no samples), on the
same 128 BPM grid as the picture. Cue times come from out/cues.json, which
tools/cues.mjs exports from src/timeline.js.

    node tools/cues.mjs && python3 tools/music.py   ->  out/soundtrack.wav
"""
import json
import pathlib
import wave

import numpy as np
from scipy import signal

ROOT = pathlib.Path(__file__).resolve().parent.parent
CUES = json.loads((ROOT / "out" / "cues.json").read_text())

SR = 48000
BEAT = CUES["beat"]
BAR = CUES["bar"]
DUR = CUES["duration"] + 1.0
N = int(SR * DUR)
rng = np.random.default_rng(1942)


def bar(n):
    return n * BAR


def midi(m):
    return 440.0 * 2 ** ((m - 69) / 12)


def tt(n):
    return np.arange(n) / SR


def ns(sec):
    return int(round(sec * SR))


# ------------------------------------------------------------------ buses --
class Bus:
    def __init__(self):
        self.x = np.zeros((2, N))

    def add(self, sig, start, gain=1.0, pan=0.0):
        """Mix a mono (n,) or stereo (2, n) signal in at `start` seconds."""
        # 5 ms fade on every tail so truncated decays never click.
        f = min(ns(0.005), sig.shape[-1])
        if f > 1:
            sig = sig.copy()
            sig[..., -f:] *= np.linspace(1, 0, f)
        if sig.ndim == 1:
            l = np.cos((pan + 1) * np.pi / 4)
            r = np.sin((pan + 1) * np.pi / 4)
            sig = np.stack([sig * l * np.sqrt(2), sig * r * np.sqrt(2)])
        i0 = ns(start)
        if i0 >= N:
            return
        if i0 < 0:
            sig = sig[:, -i0:]
            i0 = 0
        n = min(sig.shape[1], N - i0)
        self.x[:, i0 : i0 + n] += gain * sig[:, :n]


def sos_filter(x, kind, freq, order=2):
    sos = signal.butter(order, freq, btype=kind, fs=SR, output="sos")
    return signal.sosfilt(sos, x, axis=-1)


def adsr(n, a=0.005, d=0.1, s=0.7, r=0.2, sustain_len=None):
    """Attack/decay/sustain/release envelope of total length n samples."""
    env = np.zeros(n)
    A, D, R = ns(a), ns(d), ns(r)
    S = max(0, n - A - D - R) if sustain_len is None else ns(sustain_len)
    seg = [np.linspace(0, 1, max(A, 1), endpoint=False), np.linspace(1, s, max(D, 1), endpoint=False), np.full(S, s), np.linspace(s, 0, max(R, 1))]
    e = np.concatenate(seg)[:n]
    env[: len(e)] = e
    return env


def noise(n):
    return rng.standard_normal(n)


# ------------------------------------------------------------ oscillators --
def saw(freq, n, phase0=0.0):
    """PolyBLEP band-limited saw; freq may be scalar or per-sample array."""
    f = np.broadcast_to(np.asarray(freq, dtype=float), (n,))
    dt = f / SR
    ph = (phase0 + np.cumsum(dt)) % 1.0
    y = 2 * ph - 1
    m = ph < dt
    x = ph[m] / dt[m]
    y[m] -= x + x - x * x - 1
    m = ph > 1 - dt
    x = (ph[m] - 1) / dt[m]
    y[m] -= x * x + x + x + 1
    return y


def sine(freq, n, phase0=0.0):
    f = np.broadcast_to(np.asarray(freq, dtype=float), (n,))
    return np.sin(2 * np.pi * np.cumsum(f) / SR + phase0)


def supersaw(freq, n, voices=7, spread=0.18):
    """Stereo detuned saw stack."""
    out = np.zeros((2, n))
    for v in range(voices):
        det = (v - (voices - 1) / 2) / ((voices - 1) / 2)
        f = freq * 2 ** (det * spread / 12)
        s = saw(f, n, phase0=rng.random())
        pan = det * 0.8
        out[0] += s * np.cos((pan + 1) * np.pi / 4)
        out[1] += s * np.sin((pan + 1) * np.pi / 4)
    return out / voices * 1.6


# ------------------------------------------------------------- instruments --
def kick(dur=0.5, f0=170, f1=48, decay=8.5, click=0.45):
    n = ns(dur)
    t = tt(n)
    f = f1 + (f0 - f1) * np.exp(-t * 38)
    body = np.sin(2 * np.pi * np.cumsum(f) / SR) * np.exp(-t * decay)
    c = sos_filter(noise(n), "highpass", 2500) * np.exp(-t * 320) * click
    return np.tanh(1.6 * (body + c)) * 0.9


def clap(dur=0.4):
    n = ns(dur)
    t = tt(n)
    env = np.zeros(n)
    for k, off in enumerate([0.0, 0.011, 0.022]):
        i = ns(off)
        env[i:] += np.exp(-(t[: n - i]) * 190) * (0.8 if k < 2 else 1.0)
    i = ns(0.025)
    env[i:] += 0.55 * np.exp(-t[: n - i] * 16)
    s = sos_filter(noise(n), "bandpass", [900, 4200]) * env
    body = np.sin(2 * np.pi * 190 * t) * np.exp(-t * 40) * 0.3
    return (s + body) * 0.7


def hat(open_=False):
    n = ns(0.35 if open_ else 0.08)
    t = tt(n)
    s = sos_filter(noise(n), "highpass", 7500, order=4)
    return s * np.exp(-t * (11 if open_ else 60)) * 0.5


def snare(dur=0.25):
    n = ns(dur)
    t = tt(n)
    s = sos_filter(noise(n), "bandpass", [1200, 7000]) * np.exp(-t * 22)
    body = np.sin(2 * np.pi * 210 * t) * np.exp(-t * 30) * 0.5
    return (s + body) * 0.6


def pluck(freq, dur=0.32, bright=1.0):
    """Saw pluck with a decaying low-pass (approximated by a crossfade)."""
    n = ns(dur)
    t = tt(n)
    s = 0.6 * saw(freq, n) + 0.4 * saw(freq * 1.005, n)
    dark = sos_filter(s, "lowpass", min(freq * 2.5, 18000))
    brt = sos_filter(s, "lowpass", min(freq * 14 * bright, 20000))
    fenv = np.exp(-t * 22)
    y = dark + (brt - dark) * fenv
    return y * np.exp(-t * 9) * adsr(n, 0.002, 0.05, 1, 0.03)


def bass_note(freq, dur, sub=1.0, mid=0.85):
    n = ns(dur)
    env = adsr(n, 0.004, 0.08, 0.85, 0.04)
    s = sine(freq, n) * sub
    m = sos_filter(saw(freq * 2, n), "lowpass", 760) * mid
    return np.tanh((s + m) * 1.2) * env


def pad(freqs, dur, attack=0.25, release=0.7, cutoff=2600):
    n = ns(dur + release)
    out = np.zeros((2, n))
    for f in freqs:
        out += supersaw(f, n)
    out = sos_filter(out, "lowpass", cutoff)
    env = adsr(n, attack, 0.3, 0.85, release, sustain_len=max(0.0, dur - attack - 0.3))
    return out * env / max(1, len(freqs)) * 0.9


def bell(freq, dur=3.0):
    n = ns(dur)
    t = tt(n)
    parts = [(1, 1.0, 1.6), (2.0, 0.5, 2.4), (2.76, 0.35, 3.0), (5.4, 0.18, 4.5), (8.93, 0.08, 6)]
    y = sum(a * np.sin(2 * np.pi * freq * r * t) * np.exp(-t * d) for r, a, d in parts)
    return y * adsr(n, 0.002, 0.02, 1, 0.1) * 0.5


def ks_pluck(freq, dur=2.2, damp=0.996):
    """Karplus-Strong string (guzheng-ish)."""
    n = ns(dur)
    L = int(SR / freq)
    exc = sos_filter(noise(L), "lowpass", 5000) * 0.9
    x = np.zeros(n)
    x[:L] = exc
    a = np.zeros(L + 2)
    a[0] = 1
    a[L] = -damp * 0.5
    a[L + 1] = -damp * 0.5
    y = signal.lfilter([1.0], a, x)
    y = sos_filter(y, "lowpass", 6500)
    t = tt(n)
    return y * np.exp(-t * 1.1) * 0.9


def taiko(dur=2.4):
    n = ns(dur)
    t = tt(n)
    f = 48 + 60 * np.exp(-t * 18)
    body = np.sin(2 * np.pi * np.cumsum(f) / SR) * np.exp(-t * 3.2)
    skin = sos_filter(noise(n), "bandpass", [120, 900]) * np.exp(-t * 14) * 0.6
    slap = sos_filter(noise(n), "highpass", 1500) * np.exp(-t * 90) * 0.25
    return np.tanh(1.4 * (body + skin + slap))


def beep(freq, dur):
    n = ns(dur)
    t = tt(n)
    env = np.minimum(1, np.minimum(t / 0.004, (dur - t) / 0.006)).clip(0, 1)
    return (np.sin(2 * np.pi * freq * t) + 0.12 * np.sin(4 * np.pi * freq * t)) * env


def blip(freq, dur=0.07):
    n = ns(dur)
    t = tt(n)
    f = freq * (1 + 0.5 * np.exp(-t * 60))
    return np.sin(2 * np.pi * np.cumsum(f) / SR) * np.exp(-t * 45)


def tick():
    n = ns(0.03)
    t = tt(n)
    s = sos_filter(noise(n), "bandpass", [2500, 9000]) * np.exp(-t * 400)
    return s + 0.4 * np.sin(2 * np.pi * 3100 * t) * np.exp(-t * 200)


def riser(dur, f_lo=300, f_hi=9000, pitch=(110, 880)):
    n = ns(dur)
    t = tt(n)
    p = t / dur
    x = noise(n)
    # Time-varying band-pass in blocks.
    out = np.zeros(n)
    blk = 256
    zi = None
    for i in range(0, n, blk):
        pc = p[min(i + blk // 2, n - 1)]
        fc = f_lo * (f_hi / f_lo) ** (pc ** 1.5)
        lo, hi = fc * 0.6, min(fc * 1.6, SR / 2 - 100)
        sos = signal.butter(2, [lo, hi], btype="bandpass", fs=SR, output="sos")
        if zi is None:
            zi = np.zeros((sos.shape[0], 2))
        # Carry the filter state across blocks so the sweep has no clicks.
        out[i : i + blk], zi = signal.sosfilt(sos, x[i : i + blk], zi=zi)
    tone = saw(pitch[0] * (pitch[1] / pitch[0]) ** (p ** 2), n)
    tone = sos_filter(tone, "lowpass", 3000) * 0.25
    env = p ** 2.2
    return (out * 1.2 + tone) * env


def whoosh(dur=0.7, up=True):
    n = ns(dur)
    t = tt(n)
    p = t / dur
    x = noise(n)
    out = np.zeros(n)
    blk = 256
    zi = None
    for i in range(0, n, blk):
        pc = p[min(i + blk // 2, n - 1)]
        q = pc if up else 1 - pc
        fc = 250 * (7000 / 250) ** q
        sos = signal.butter(2, [fc * 0.5, min(fc * 1.8, 23000)], btype="bandpass", fs=SR, output="sos")
        if zi is None:
            zi = np.zeros((sos.shape[0], 2))
        out[i : i + blk], zi = signal.sosfilt(sos, x[i : i + blk], zi=zi)
    env = np.sin(np.pi * p) ** 1.5
    pan = np.linspace(-0.8, 0.8, n)
    st = np.stack([out * env * np.cos((pan + 1) * np.pi / 4), out * env * np.sin((pan + 1) * np.pi / 4)])
    return st * 1.4


def impact(size=1.0, dur=3.0):
    n = ns(dur)
    t = tt(n)
    f = 32 + 70 * np.exp(-t * 9)
    boom = np.sin(2 * np.pi * np.cumsum(f) / SR) * np.exp(-t * (1.6 / size))
    crash = sos_filter(noise(n), "lowpass", 7000) * np.exp(-t * 3.5) * 0.45
    crack = sos_filter(noise(n), "highpass", 1200) * np.exp(-t * 40) * 0.6
    return np.tanh(1.3 * (boom * 1.1 + crash + crack)) * size


def reverse_swell(dur=1.0):
    n = ns(dur)
    t = tt(n)
    x = sos_filter(noise(n), "bandpass", [400, 9000]) * np.exp(-t * 5)
    return x[::-1] * 0.8


def glitch(dur=0.25):
    n = ns(dur)
    x = noise(n)
    hold = 40
    x = np.repeat(x[::hold], hold)[:n]
    x = np.round(x * 3) / 3
    gate = (np.floor(tt(n) / (BEAT / 8)) % 2 == 0).astype(float)
    tone = np.sign(np.sin(2 * np.pi * 440 * tt(n))) * 0.3
    return sos_filter((x + tone) * gate, "bandpass", [300, 6000]) * 0.6


def stamp():
    n = ns(0.6)
    t = tt(n)
    thud = np.sin(2 * np.pi * (60 + 90 * np.exp(-t * 40)) * t) * np.exp(-t * 14)
    wood = sos_filter(noise(n), "bandpass", [600, 2500]) * np.exp(-t * 60) * 0.7
    return np.tanh(1.5 * (thud + wood))


# ---------------------------------------------------------------- harmony --
# Voicings as MIDI note lists: (pad voices, bass root, arp notes)
CH = {
    "Am": ([57, 60, 64, 69], 33, [57, 60, 64, 69, 72, 69, 64, 60]),
    "Am9": ([57, 59, 60, 64, 67], 33, [57, 60, 64, 67, 71, 67, 64, 60]),
    "F": ([53, 57, 60, 65], 29, [53, 57, 60, 65, 69, 65, 60, 57]),
    "Fmaj7": ([53, 57, 60, 64], 29, [53, 57, 60, 64, 69, 64, 60, 57]),
    "C": ([55, 60, 64, 67], 36, [55, 60, 64, 67, 72, 67, 64, 60]),
    "Cadd9": ([55, 60, 62, 64, 67], 36, [60, 62, 64, 67, 72, 67, 64, 62]),
    "G": ([55, 59, 62, 67], 31, [55, 59, 62, 67, 71, 67, 62, 59]),
    "Dm7": ([53, 57, 60, 62], 38, [50, 53, 57, 60, 62, 60, 57, 53]),
    "Esus4": ([52, 57, 59, 64], 28, [52, 57, 59, 64, 69, 64, 59, 57]),
}
PROG = {}
for b, c in enumerate(["Am9"] * 4 + ["Am", "F", "C", "G"] + ["Am", "F", "C", "G", "Am", "F", "G"]
                      + ["Am", "Am", "F", "C", "G", "F", "G"] + ["Am9", "Fmaj7", "Dm7", "Esus4"]
                      + ["F", "G", "Am", "G"] + ["Cadd9", "Fmaj7", "Cadd9"]):
    PROG[b] = c

master = Bus()
drums = Bus()
music = Bus()  # sidechained
fx = Bus()
verb_send = Bus()

# ------------------------------------------------------------- arrangement --
def section(b0, b1):
    return range(b0, b1)


# Pads.
for b, c in PROG.items():
    if b >= 33:
        continue
    notes = CH[c][0]
    start = bar(b)
    if b == 0:
        # One long swell for the whole intro.
        p = pad([midi(m) for m in notes], bar(4), attack=2.5, release=0.8, cutoff=1700)
        music.add(p, 0.0, 0.32)
        verb_send.add(p, 0.0, 0.1)
        continue
    if b <= 3:
        continue
    elif 22 <= b <= 25:
        g, cut = 0.4, 2400
    elif b >= 31:
        g, cut = 0.46, 3800
    else:
        g, cut = 0.48, 4200
    p = pad([midi(m) for m in notes], BAR * (1.0 if b != 32 else 2.2), attack=0.3, cutoff=cut)
    music.add(p, start, g)
    verb_send.add(p, start, g * 0.5)

# Sub drone in the intro.
n = ns(bar(4))
drone = sine(midi(33), n) * np.minimum(1, tt(n) / 3.0) * 0.07
music.add(drone, 0.0)

# Morse beeps (A5) — exactly on the visual elements.
for t0, t1 in CUES["morseIntro"]:
    b = beep(midi(81), t1 - t0)
    fx.add(b, t0, 0.22)
    verb_send.add(b, t0, 0.12)
for t0, t1 in CUES["morseOutro"]:
    b = beep(midi(81), t1 - t0)
    fx.add(b, t0, 0.16)
    verb_send.add(b, t0, 0.14)

# Radio static bed in the intro.
n = ns(bar(3) + 0.5)
st = sos_filter(noise(n), "bandpass", [800, 4500]) * 0.03
crackle = (rng.random(n) > 0.9993).astype(float) * rng.standard_normal(n) * 0.12
st += sos_filter(sos_filter(crackle, "highpass", 1500), "lowpass", 6000)
st *= np.minimum(1, tt(n) / 1.0) * np.clip((bar(3) + 0.5 - tt(n)) / 1.2, 0, 1)
fx.add(st, 0.0, 0.8, pan=-0.2)

# Heartbeat thumps with the rings, riser and reverse crash into the drop.
for i, tb in enumerate([bar(3), bar(3) + BEAT, bar(3) + 2 * BEAT, bar(3) + 3 * BEAT, bar(3) + 3.5 * BEAT]):
    drums.add(kick(0.4, f0=120, f1=42, decay=9, click=0.1), tb, 0.35 + 0.1 * i)
fx.add(riser(bar(4) - bar(3) + 0.3), bar(3) - 0.3, 0.22)
fx.add(reverse_swell(0.9), bar(4) - 0.9, 0.35)


def big_hit(t0, size=1.0, chord=None):
    fx.add(impact(size), t0, 0.75 * size)
    verb_send.add(impact(size, 1.0), t0, 0.35 * size)
    if chord:
        s = pad([midi(m + 12) for m in CH[chord][0]], 0.25, attack=0.005, release=1.2, cutoff=6000)
        fx.add(s, t0, 0.35 * size)
        verb_send.add(s, t0, 0.3 * size)


big_hit(bar(4), 1.0, "Am")

# Groove helpers.
kicks = []


def groove(b0, b1, hats=True, clap_on=True, bass=True, arp=True, arp_gain=0.1, open_hats=True, kick_gain=0.64):
    for b in range(b0, b1):
        c = PROG[b]
        pad_notes, root, arp_notes = CH[c]
        for k in range(4):
            tk = bar(b) + k * BEAT
            drums.add(kick(), tk, kick_gain)
            kicks.append(tk)
            if clap_on and k in (1, 3):
                drums.add(clap(), tk, 0.6, pan=0.05)
                verb_send.add(clap(), tk, 0.12)
            if hats:
                drums.add(hat(), tk + BEAT / 2, 0.34, pan=0.25)
                if open_hats and k % 2 == 1:
                    drums.add(hat(True), tk + BEAT / 2, 0.18, pan=-0.2)
                drums.add(hat(), tk + BEAT / 4, 0.15, pan=0.35)
                drums.add(hat(), tk + 3 * BEAT / 4, 0.15, pan=0.35)
            if bass:
                # Offbeat pumping bass with a 16th pickup.
                music.add(bass_note(midi(root), BEAT / 2 - 0.02), tk + BEAT / 2, 0.23)
                if k == 3:
                    music.add(bass_note(midi(root + 12), BEAT / 4 - 0.02), tk + 3 * BEAT / 4, 0.2)
        if arp:
            for s in range(16):
                m = arp_notes[s % 8] + (12 if s >= 8 and b % 2 else 0)
                p = pluck(midi(m), 0.3, bright=0.8 + 0.2 * (s % 4 == 0))
                pan = 0.35 * np.sin(s * 0.8)
                music.add(p, bar(b) + s * BEAT / 4, arp_gain, pan=pan)
                verb_send.add(p, bar(b) + s * BEAT / 4, arp_gain * 0.35)


# Title: bars 4-5 kick+bass, 6-7 full.
groove(4, 6, hats=False, clap_on=False, arp=False)
groove(6, 8, arp=True, arp_gain=0.2)
# Snare fill + glitch + whoosh out of the title.
for i in range(8):
    drums.add(snare(), bar(7) + 2 * BEAT + i * BEAT / 4, 0.12 + 0.03 * i)
fx.add(glitch(0.24), bar(7) + 1.5 * BEAT, 0.35)
fx.add(whoosh(0.7), bar(7) + 2 * BEAT, 0.3)

# Timeline: bars 8-14.
big_hit(bar(8), 0.55)
groove(8, 15, arp_gain=0.27)
for i, m in enumerate(CUES["milestones"]):
    t_start = m - (0.55 if i == 0 else 0.34)
    t_end = m + (0.25 if i == 0 else 0.2)
    k = 0
    tk = t_start
    while tk < t_end:
        fx.add(tick(), tk, 0.1 + 0.05 * (k % 2), pan=-0.3 + 0.6 * ((k * 7) % 5) / 4)
        tk += BEAT / 8
        k += 1
    b = blip(midi(88 + i), 0.12)
    fx.add(b, m, 0.12)
    verb_send.add(b, m, 0.12)

# Warp: bar 15 first half.
S = CUES["strength"]
fx.add(whoosh(1.3), S["warp"] - 0.25, 0.55)
fx.add(riser(1.0, 800, 12000, (220, 1760)), S["warp"], 0.2)
fx.add(reverse_swell(0.8), S["headline"] - 0.8, 0.35)
drums.add(kick(0.9, f0=90, f1=30, decay=2.5, click=0.0), S["warp"], 0.6)
big_hit(S["headline"], 0.85, "Am")

# Strengths groove from the second half of bar 15.
groove(16, 22, arp_gain=0.29)
# Half bar of drums after the warp.
for k in range(2, 4):
    tk = bar(15) + k * BEAT
    drums.add(kick(), tk, 0.9)
    kicks.append(tk)
    drums.add(hat(), tk + BEAT / 2, 0.2)
# Counter-melody (bell lead) over the stats.
lead = [(16, 76, 2), (17, 77, 2), (18, 79, 2), (19, 74, 2), (20, 72, 2), (21, 74, 1), (21.5, 79, 1)]
for b, m, beats in lead:
    s = bell(midi(m), 2.5)
    music.add(s, bar(b), 0.16, pan=0.1)
    verb_send.add(s, bar(b), 0.12)
# Stat hits + counters.
for i, ts in enumerate(S["stats"]):
    fx.add(impact(0.45, 1.6), ts, 0.4)
    fx.add(whoosh(0.35), ts - 0.3, 0.18)
for ts, count in [(S["stats"][2], 6), (S["stats"][3], 27)]:
    steps = min(count, 16)
    for k in range(steps):
        tk = ts + 0.02 + 0.73 * (1 - (1 - (k + 1) / steps) ** 3)
        fx.add(blip(midi(84 + k % 12), 0.05), tk, 0.08)
# Lab: shimmer.
for k in range(12):
    m = [69, 72, 76, 79, 81, 84][k % 6] + 12 * (k // 6)
    s = bell(midi(m), 1.8)
    fx.add(s, S["lab"] + k * BEAT / 4, 0.05, pan=np.sin(k))
    verb_send.add(s, S["lab"] + k * BEAT / 4, 0.08)
fx.add(whoosh(0.6), S["lab"] - 0.35, 0.25)
# Downlifter into the breakdown.
fx.add(whoosh(1.0, up=False), bar(22) - 0.8, 0.3)

# Motto: breakdown with taiko and guzheng.
for i, tm in enumerate(CUES["motto"]):
    drums.add(taiko(), tm, 0.62)
    verb_send.add(taiko(), tm, 0.4)
    gl = [57, 60, 62, 64, 67, 69]
    for k, m in enumerate(gl):
        s = ks_pluck(midi(m + 12), 1.6)
        music.add(s, tm + 0.03 + k * 0.028, 0.18, pan=-0.4 + 0.16 * k)
        verb_send.add(s, tm + 0.03 + k * 0.028, 0.08)
    phrases = [[(1.5, 76), (2.0, 74), (3.0, 72)], [(1.5, 72), (2.0, 69), (3.0, 67)], [(1.5, 74), (2.0, 72), (3.0, 69)], [(1.0, 76), (2.0, 79), (3.0, 81)]]
    for beat_off, m in phrases[i]:
        s = ks_pluck(midi(m), 2.2)
        music.add(s, tm + beat_off * BEAT, 0.3, pan=0.2)
        verb_send.add(s, tm + beat_off * BEAT, 0.16)
fx.add(stamp(), CUES["seal"] + 0.16, 0.6)
verb_send.add(stamp(), CUES["seal"] + 0.16, 0.2)
fx.add(reverse_swell(0.6), bar(26) - 0.6, 0.25)

# Spirit.
SP = CUES["spirit"]
fx.add(impact(0.5, 2.0), SP["xin"], 0.45)
s = bell(midi(69), 4.0)
fx.add(s, SP["xin"], 0.25)
verb_send.add(s, SP["xin"], 0.3)
for k in range(2):
    tk = bar(26) + k * 2 * BEAT
    drums.add(kick(0.5, decay=6), tk, 0.6)
    kicks.append(tk)
fx.add(whoosh(0.5), SP["xin"] + 0.35, 0.15)
fx.add(whoosh(0.5), SP["line1"][0] - 0.25, 0.25)
for i, th in enumerate(SP["line1"][1:] + SP["line2"]):
    drums.add(taiko(1.2), th, 0.55)
    kicks.append(th)
    c = "G" if th < bar(28) else "Am"
    stab = pad([midi(m + 12) for m in CH[c][0]], 0.12, attack=0.003, release=0.5, cutoff=5000)
    fx.add(stab, th, 0.16 + 0.02 * i)
    verb_send.add(stab, th, 0.15)
# Build: snare roll + riser + kicks.
b0 = SP["build"]
t = b0
k = 0
while t < bar(30) - 0.1:
    frac = (t - b0) / BAR
    step = BEAT / 4 if frac < 0.5 else BEAT / 8
    drums.add(snare(0.15), t, 0.08 + 0.3 * frac ** 1.5)
    t += step
for k in range(4):
    tk = b0 + k * BEAT
    drums.add(kick(), tk, 0.8)
    kicks.append(tk)
fx.add(riser(BAR + 0.05, 300, 12000, (110, 1760)), b0, 0.3)
fx.add(reverse_swell(1.0), bar(30) - 1.0, 0.45)

# Finale.
F = CUES["finale"]["hit"]
big_hit(F, 1.25, "Cadd9")
groove(30, 31, arp_gain=0.27)
s = bell(midi(72), 5.0)
fx.add(s, F, 0.25)
verb_send.add(s, F, 0.3)
for sidx in range(24):
    m = CH["Fmaj7"][2][sidx % 8] + 12
    tk = bar(31) + sidx * BEAT / 4
    if tk > 60.2:
        break
    p = pluck(midi(m), 0.4, 0.7)
    music.add(p, tk, 0.07 * (1 - sidx / 26), pan=0.4 * np.sin(sidx))
    verb_send.add(p, tk, 0.05)
s = bell(midi(84), 3.5)
fx.add(s, 60.0, 0.12)
verb_send.add(s, 60.0, 0.25)

# ----------------------------------------------------------------- mixing --
tvec = tt(N)
duck = np.ones(N)
for tk in kicks:
    i0 = ns(tk)
    L = ns(0.4)
    seg = 1 - 0.6 * np.exp(-tt(L) / 0.11)
    seg[: ns(0.004)] = np.linspace(1, seg[ns(0.004)], ns(0.004))
    end = min(N, i0 + L)
    duck[i0:end] = np.minimum(duck[i0:end], seg[: end - i0])

# Delay on the music bus (dotted-eighth ping-pong).
dly = ns(BEAT * 0.75)
m = music.x * duck
echo = np.zeros_like(m)
g = 0.28
src = m.mean(axis=0)
for k in range(1, 5):
    ch = k % 2
    off = dly * k
    echo[ch, off:] += src[:-off] * g ** k
echo = sos_filter(echo, "bandpass", [300, 6000])

# Reverb.
L = ns(2.8)
ir_t = tt(L)
ir = rng.standard_normal((2, L)) * np.exp(-ir_t * 2.4)
ir = sos_filter(ir, "lowpass", 6500)
ir[:, : ns(0.018)] = 0
ir /= np.sqrt((ir ** 2).sum(axis=1, keepdims=True))
wet = np.stack([signal.fftconvolve(verb_send.x[c], ir[c])[:N] for c in range(2)])
wet = sos_filter(wet, "highpass", 180)

mix = drums.x * 1.0 + m * 1.0 + echo * 0.5 + fx.x * 1.0 + wet * 0.55
mix = sos_filter(mix, "highpass", 30)
# Presence lift.
mix = mix + 0.35 * sos_filter(mix, "highpass", 2500)

# Master: gentle saturation, loudness to -14 LUFS, then a true-peak limiter
# (peaks detected on a 4x oversampled signal so AAC encoding will not clip).
import pyloudnorm
from scipy.ndimage import maximum_filter1d, minimum_filter1d, uniform_filter1d

mix = np.tanh(mix * 0.8) / 0.8
meter = pyloudnorm.Meter(SR)
lufs = meter.integrated_loudness(mix.T)
mix *= 10 ** ((-14.0 - lufs) / 20)
up = signal.resample_poly(mix, 4, 1, axis=1)
tp = np.abs(up).max(axis=0).reshape(-1, 4).max(axis=1)[:N]
ceiling = 10 ** (-1.3 / 20)
want = np.minimum(1.0, ceiling / np.maximum(tp, 1e-9))
look = ns(0.003)
gain = minimum_filter1d(want, size=2 * look + 1)  # look-ahead hold
rel = np.exp(-1 / (SR * 0.08))
g = gain.copy()
for i in range(1, len(g)):  # release smoothing (attack is instant thanks to the hold)
    if g[i] > g[i - 1]:
        g[i] = g[i - 1] * rel + g[i] * (1 - rel)
gain = uniform_filter1d(g, size=look)
mix = mix * np.minimum(gain, want * 0 + 1)
print("pre-limit LUFS", round(lufs, 2), "limiter max reduction dB", round(20 * np.log10(gain.min()), 2))

# Tail fade.
end = CUES["duration"]
fade = np.clip((end + 0.8 - tvec) / 1.6, 0, 1)
mix *= fade
mix = mix[:, : ns(end + 0.2)]

out = ROOT / "out" / "soundtrack.wav"
pcm = (np.clip(mix, -1, 1) * 32767).astype(np.int16).T.copy()
with wave.open(str(out), "wb") as w:
    w.setnchannels(2)
    w.setsampwidth(2)
    w.setframerate(SR)
    w.writeframes(pcm.tobytes())
print(out, pcm.shape[0] / SR, "s", "peak", np.abs(mix).max())
