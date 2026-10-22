// A 3x5 pixel font for the little numbers that float above the cafe.

const GLYPHS = {
  0: ['###', '#.#', '#.#', '#.#', '###'],
  1: ['.#.', '##.', '.#.', '.#.', '###'],
  2: ['###', '..#', '###', '#..', '###'],
  3: ['###', '..#', '.##', '..#', '###'],
  4: ['#.#', '#.#', '###', '..#', '..#'],
  5: ['###', '#..', '###', '..#', '###'],
  6: ['###', '#..', '###', '#.#', '###'],
  7: ['###', '..#', '.#.', '.#.', '.#.'],
  8: ['###', '#.#', '###', '#.#', '###'],
  9: ['###', '#.#', '###', '..#', '###'],
  '+': ['...', '.#.', '###', '.#.', '...'],
};

export function textWidth(text, scale = 1) {
  return (text.length * 4 - 1) * scale;
}

/** Draw text with a 1px outline. (x, y) is the top-left of the glyphs; `scale` enlarges each glyph pixel. */
export function drawText(ctx, text, x, y, color, outline, scale = 1) {
  const pixels = [];
  [...text].forEach((ch, i) => {
    const g = GLYPHS[ch];
    if (!g) return;
    g.forEach((row, gy) => {
      for (let gx = 0; gx < 3; gx++) if (row[gx] === '#') pixels.push([x + (i * 4 + gx) * scale, y + gy * scale]);
    });
  });
  if (outline) {
    ctx.fillStyle = outline;
    for (const [px, py] of pixels) ctx.fillRect(px - 1, py - 1, scale + 2, scale + 2);
  }
  ctx.fillStyle = color;
  for (const [px, py] of pixels) ctx.fillRect(px, py, scale, scale);
}
