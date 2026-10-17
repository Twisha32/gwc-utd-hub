// The hero art: a bitmap "GWC" lit up on a grid of dots, like an old LED sign.
// Pure SVG, no state, so it renders identically on server and client.

const GLYPHS: Record<string, string[]> = {
  G: ['01110', '10001', '10000', '10111', '10001', '10001', '01111'],
  W: ['10001', '10001', '10001', '10101', '10101', '11011', '10001'],
  C: ['01110', '10001', '10000', '10000', '10000', '10001', '01110'],
};

const WORD = 'GWC';
const COLS = 25;
const ROWS = 11;
const STEP = 24;
const R = 6;

const FROM = [183, 148, 255]; // lilac
const TO = [255, 111, 168]; // pink

const mix = (t: number) =>
  `rgb(${FROM.map((f, i) => Math.round(f + (TO[i] - f) * t)).join(',')})`;

// cheap deterministic scatter so the unlit dots aren't a perfect wall
const scatter = (c: number, r: number) => ((c * 73856093) ^ (r * 19349663)) % 100;

function lit() {
  const letterW = 5;
  const gap = 2;
  const width = WORD.length * letterW + (WORD.length - 1) * gap;
  const left = Math.floor((COLS - width) / 2);
  const top = Math.floor((ROWS - 7) / 2);
  const on = new Map<string, { c: number; r: number; t: number }>();

  [...WORD].forEach((ch, li) => {
    GLYPHS[ch].forEach((row, r) => {
      [...row].forEach((bit, c) => {
        if (bit !== '1') return;
        const col = left + li * (letterW + gap) + c;
        const rr = top + r;
        on.set(`${col}:${rr}`, { c: col, r: rr, t: (col - left) / (width - 1) });
      });
    });
  });
  return { on, left, width };
}

export function DotMatrix() {
  const { on, left, width } = lit();
  const top = Math.floor((ROWS - 7) / 2);
  const inWord = (c: number, r: number) => c >= left && c < left + width && r >= top && r < top + 7;

  const off: { c: number; r: number; ember: boolean }[] = [];
  for (let r = 0; r < ROWS; r++) {
    for (let c = 0; c < COLS; c++) {
      if (!on.has(`${c}:${r}`)) off.push({ c, r, ember: !inWord(c, r) && scatter(c, r) < 7 });
    }
  }

  const pos = (n: number) => n * STEP + STEP / 2;

  return (
    <svg
      viewBox={`0 0 ${COLS * STEP} ${ROWS * STEP}`}
      role="img"
      aria-label="The letters GWC drawn in glowing dots"
    >
      <g>
        {off.map(({ c, r, ember }) => (
          <circle
            key={`${c}:${r}`}
            cx={pos(c)}
            cy={pos(r)}
            r={R}
            className={ember ? 'dm-ember' : 'dm-off'}
          />
        ))}
      </g>
      <g className="dm-glow">
        {[...on.values()].map(({ c, r, t }) => (
          <circle
            key={`${c}:${r}`}
            cx={pos(c)}
            cy={pos(r)}
            r={R + 0.6}
            fill={mix(t)}
            className="dm-on"
            style={{ ['--c' as string]: c - left }}
          />
        ))}
      </g>
    </svg>
  );
}
