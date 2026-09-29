/** A decorative Code-39-looking barcode drawn from a string. Not scannable, and not meant to be. */
export function Barcode({ value, height = 34, className }: { value: string; height?: number; className?: string }) {
  let x = 0;
  const bars: { x: number; w: number }[] = [];
  for (let i = 0; i < 46; i++) {
    const code = value.charCodeAt(i % Math.max(value.length, 1)) || 65;
    const w = 1 + ((code * (i + 3)) % 3);
    if (i % 2 === 0) bars.push({ x, w });
    x += w + (i % 3 === 0 ? 1 : 0) + 1;
  }
  return (
    <svg viewBox={`0 0 ${x} ${height}`} preserveAspectRatio="none" className={className} height={height} aria-hidden>
      {bars.map((b, i) => <rect key={i} x={b.x} y={0} width={b.w} height={height} fill="currentColor" />)}
    </svg>
  );
}
