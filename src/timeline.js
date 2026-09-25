// Master timeline. Every visual and every sound cue is derived from these
// numbers, so picture and soundtrack stay locked to the same 128 BPM grid.

export const BPM = 128;
export const BEAT = 60 / BPM; // 0.46875 s
export const BAR = BEAT * 4; // 1.875 s
export const bar = (n) => n * BAR;
export const FPS = 60;
export const W = 1920;
export const H = 1080;
export const DURATION = 61.5;

// Sections (seconds).
export const S = {
  intro: [0, bar(4)],
  title: [bar(4), bar(8)],
  timeline: [bar(8), bar(15)],
  strengths: [bar(15), bar(22)],
  motto: [bar(22), bar(26)],
  spirit: [bar(26), bar(30)],
  finale: [bar(30), DURATION],
};

// ---------------------------------------------------------------- Morse ---
export const MORSE_CODE = {
  A: '.-', J: '.---', N: '-.', P: '.--.', R: '.-.', T: '-', U: '..-',
};

// Standard Morse timing: dot = 1 unit, dash = 3, gap inside a letter = 1,
// gap between letters = 3. One unit = a 32nd note so the beeps sit on the grid.
export function morse(text, start, unit) {
  const elements = [];
  const letters = [];
  let u = 0;
  [...text].forEach((ch, li) => {
    const code = MORSE_CODE[ch];
    const first = u;
    [...code].forEach((sym, si) => {
      const len = sym === '-' ? 3 : 1;
      elements.push({
        letter: li,
        dash: sym === '-',
        u0: u,
        u1: u + len,
        t0: start + u * unit,
        t1: start + (u + len) * unit,
      });
      u += len;
      if (si < code.length - 1) u += 1;
    });
    letters.push({ ch, code, u0: first, u1: u, t0: start + first * unit, t1: start + u * unit });
    if (li < text.length - 1) u += 3;
  });
  return { elements, letters, units: u, end: start + u * unit };
}

export const MORSE_INTRO = morse('NJUPT', bar(1), BEAT / 8);
// "AR" is the Morse prosign for "end of message".
export const MORSE_OUTRO = morse('AR', 60.0, BEAT / 8);

// ------------------------------------------------------------- Timeline ---
// Six milestones inside bars 8..15, measured in half bars (3,2,3,2,2,2).
export const MILESTONES = [
  {
    year: 1942,
    t: bar(8),
    title: '诞生于山东抗日根据地',
    sub: '前身为八路军战邮干训班',
    en: 'BORN IN THE SHANDONG ANTI-JAPANESE BASE AREA',
  },
  {
    year: 1949,
    t: bar(9.5),
    title: '随军南下 · 迁至南京',
    sub: '扎根六朝古都',
    en: 'MOVED SOUTH TO NANJING',
  },
  {
    year: 1958,
    t: bar(10.5),
    title: '定名南京邮电学院',
    sub: '经国务院批准 · 升格为本科院校',
    en: 'NANJING INSTITUTE OF POSTS AND TELECOMMUNICATIONS',
  },
  {
    year: 2005,
    t: bar(12),
    title: '更名为南京邮电大学',
    sub: '经教育部批准',
    en: 'RENAMED NJUPT',
  },
  {
    year: 2017,
    t: bar(13),
    title: '入选国家首批\n“双一流”建设高校',
    sub: '建设学科 · 电子科学与技术',
    en: 'DOUBLE FIRST-CLASS UNIVERSITY',
  },
  {
    year: 2022,
    t: bar(14),
    title: '再次入选第二轮\n“双一流”建设高校',
    sub: '红色基因厚重 · 信息特色鲜明',
    en: 'SECOND ROUND · DOUBLE FIRST-CLASS',
  },
];

// ------------------------------------------------------------ Strengths ---
export const STRENGTH = {
  warp: bar(15),
  headline: bar(15.5),
  stats: [bar(17), bar(18), bar(19), bar(20)],
  lab: bar(21),
};

// ---------------------------------------------------------------- Motto ---
export const MOTTO = [
  { words: '厚德', quote: '君子以厚德载物', src: '《周易》', t: bar(22) },
  { words: '弘毅', quote: '士不可以不弘毅，任重而道远', src: '《论语》', t: bar(23) },
  { words: '求是', quote: '修学好古，实事求是', src: '《汉书》', t: bar(24) },
  { words: '笃行', quote: '博学之，审问之，慎思之，明辨之，笃行之', src: '《礼记》', t: bar(25) },
];
export const SEAL_T = bar(25.5);

// --------------------------------------------------------------- Spirit ---
export const SPIRIT = {
  xin: bar(26),
  line1: [bar(27), bar(27) + BEAT, bar(27) + 2 * BEAT, bar(27) + 3 * BEAT],
  line2: [bar(28), bar(28) + BEAT, bar(28) + 2 * BEAT, bar(28) + 3 * BEAT],
  build: bar(29),
};

export const FINALE = { hit: bar(30), fade: 60.0 };

// Sound-design cues shared with tools/music.py (exported via tools/cues.mjs).
export function cues() {
  return {
    bpm: BPM,
    beat: BEAT,
    bar: BAR,
    duration: DURATION,
    sections: S,
    morseIntro: MORSE_INTRO.elements.map((e) => [e.t0, e.t1]),
    morseOutro: MORSE_OUTRO.elements.map((e) => [e.t0, e.t1]),
    milestones: MILESTONES.map((m) => m.t),
    strength: STRENGTH,
    motto: MOTTO.map((m) => m.t),
    seal: SEAL_T,
    spirit: SPIRIT,
    finale: FINALE,
  };
}
