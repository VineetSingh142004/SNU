/*
 * Line-art emblem: a coiled rattlesnake with raised head and lifted rattle,
 * drawn as SVG so the loader can "ink" it stroke by stroke.
 */
const TAU = Math.PI * 2;

function spiralPath() {
  const cx = 100;
  const cy = 140;
  const turns = 2.2;
  const aEnd = Math.PI / 2 + 0.55;
  const a0 = aEnd - turns * TAU;
  const pts = [];
  const n = 220;
  for (let i = 0; i <= n; i++) {
    const t = i / n;
    const a = a0 + t * turns * TAU;
    const r = 11 + t * 67;
    pts.push([cx + r * Math.cos(a), cy + r * Math.sin(a) * 0.4 - (1 - t) * 10]);
  }
  return pts;
}

export function emblemSVG() {
  const s = spiralPath();
  const [sx, sy] = s[0];
  const [ex, ey] = s[s.length - 1];
  const coil = 'M' + s.map(([x, y]) => `${x.toFixed(2)} ${y.toFixed(2)}`).join(' L');
  // neck rises from the front of the coil in an S and ends at the back of the head
  const neck = `M${ex.toFixed(2)} ${ey.toFixed(2)} C ${ex - 34} ${ey - 20}, ${38} ${96}, ${70} ${70} S ${92} ${50}, 104 47`;
  // tail lifts out of the centre of the coil
  const tail = `M${sx.toFixed(2)} ${sy.toFixed(2)} C ${sx + 10} ${sy - 12}, ${126} ${112}, 128 98`;
  const rattle = [0, 1, 2, 3, 4, 5]
    .map((k) => {
      const y = 94 - k * 5.2;
      const rx = 4.4 - k * 0.42;
      return `<ellipse class="emblem-stroke" cx="${128.6 + k * 0.5}" cy="${y}" rx="${rx}" ry="2.6" stroke-width="1.1" />`;
    })
    .join('');
  const head = 'M104 39 Q117 33 131 41 Q138 45 131 48.5 Q117 55 104 53 Q98 46 104 39 Z';

  return `
  <svg viewBox="0 0 200 200" role="img" aria-label="Coiled rattlesnake emblem">
    <defs>
      <linearGradient id="snGold" x1="0" y1="0" x2="1" y2="1">
        <stop offset="0" stop-color="#8a6a32"/>
        <stop offset=".3" stop-color="#ecd49a"/>
        <stop offset=".55" stop-color="#b88d43"/>
        <stop offset=".8" stop-color="#f3dfaa"/>
        <stop offset="1" stop-color="#9c7736"/>
      </linearGradient>
    </defs>
    <path class="emblem-stroke" d="${coil}" stroke-width="7.5"/>
    <path class="emblem-stroke" d="${neck}" stroke-width="6.5"/>
    <path class="emblem-stroke" d="${tail}" stroke-width="3.2"/>
    ${rattle}
    <path class="emblem-stroke" d="${head}" stroke-width="1.6"/>
    <path class="emblem-stroke" d="M112 44.5 L124 43" stroke-width="0.9"/>
    <circle cx="121" cy="41.8" r="1.5" fill="#ecd49a"/>
    <path class="emblem-stroke" d="M131 46 l7 -1.5 M138 44.5 l3 -2 M138 44.5 l3 1.4" stroke-width="0.8"/>
  </svg>`;
}
