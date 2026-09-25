"""Print per-section band energies (dB) of the soundtrack for mix balancing."""
import json, sys, wave
import numpy as np
from scipy import signal
p = sys.argv[1] if len(sys.argv) > 1 else 'out/soundtrack.wav'
w = wave.open(p); sr = w.getframerate(); n = w.getnframes()
x = np.frombuffer(w.readframes(n), dtype=np.int16).reshape(-1, 2).astype(float).mean(axis=1) / 32768
cues = json.load(open('out/cues.json'))
bands = [(20, 60), (60, 250), (250, 2000), (2000, 6000), (6000, 16000)]
print(f"{'section':10s} {'rms':>6s} " + ' '.join(f'{a}-{b}'.rjust(10) for a, b in bands))
for name, (a, b) in cues['sections'].items():
    seg = x[int(a * sr):int(b * sr)]
    f, P = signal.welch(seg, sr, nperseg=8192)
    tot = 10 * np.log10(np.mean(seg ** 2) + 1e-12)
    vals = []
    for lo, hi in bands:
        m = (f >= lo) & (f < hi)
        vals.append(10 * np.log10(np.trapezoid(P[m], f[m]) + 1e-12))
    print(f"{name:10s} {tot:6.1f} " + ' '.join(f'{v:10.1f}' for v in vals))
