// Writes out/cues.json so the soundtrack generator uses the exact same timings.
import fs from 'node:fs';
import { cues, MILESTONES } from '../src/timeline.js';
fs.mkdirSync('out', { recursive: true });
const c = cues();
c.milestoneYears = MILESTONES.map((m) => m.year);
fs.writeFileSync('out/cues.json', JSON.stringify(c, null, 1));
console.log('wrote out/cues.json');
