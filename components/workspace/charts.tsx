// Hand-rolled SVG charts.
//
// Deliberately dependency-free and server-renderable: the whole app ships
// without a charting library (same reasoning as lib/agents.ts calling the
// provider REST APIs directly), and these render inside Server Components
// with no client JS at all. Every chart scales via a viewBox, so the parent
// controls width and the shapes stay crisp at any size.

function pathFrom(points: number[], w: number, h: number, pad: number) {
  const max = Math.max(...points);
  const min = Math.min(...points);
  const span = max - min || 1;
  const stepX = (w - pad * 2) / (points.length - 1 || 1);
  return points.map((p, i) => {
    const x = pad + i * stepX;
    const y = pad + (h - pad * 2) * (1 - (p - min) / span);
    return { x, y };
  });
}

function smooth(pts: { x: number; y: number }[]) {
  if (pts.length < 2) return "";
  let d = `M ${pts[0].x} ${pts[0].y}`;
  for (let i = 0; i < pts.length - 1; i++) {
    const a = pts[i];
    const b = pts[i + 1];
    const cx = (a.x + b.x) / 2;
    d += ` C ${cx} ${a.y}, ${cx} ${b.y}, ${b.x} ${b.y}`;
  }
  return d;
}

export function AreaChart({
  points,
  labels = [],
  height = 200,
  color = "#2563eb",
  id = "area"
}: {
  points: number[];
  labels?: string[];
  height?: number;
  color?: string;
  id?: string;
}) {
  const w = 640;
  const h = height;
  const pad = 16;
  const pts = pathFrom(points, w, h - 18, pad);
  const line = smooth(pts);
  const area = `${line} L ${pts[pts.length - 1].x} ${h - 18} L ${pts[0].x} ${h - 18} Z`;
  const gid = `grad-${id}`;

  return (
    <div className="chart-wrap">
      <svg viewBox={`0 0 ${w} ${h}`} role="img" aria-label="Trend over time" preserveAspectRatio="none">
        <defs>
          <linearGradient id={gid} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={color} stopOpacity="0.22" />
            <stop offset="100%" stopColor={color} stopOpacity="0" />
          </linearGradient>
        </defs>
        {[0.25, 0.5, 0.75].map((f) => (
          <line
            key={f}
            x1={pad}
            x2={w - pad}
            y1={pad + (h - 18 - pad * 2) * f}
            y2={pad + (h - 18 - pad * 2) * f}
            stroke="currentColor"
            strokeOpacity="0.08"
            strokeWidth="1"
          />
        ))}
        <path d={area} fill={`url(#${gid})`} />
        <path d={line} fill="none" stroke={color} strokeWidth="2.5" strokeLinecap="round" vectorEffect="non-scaling-stroke" />
      </svg>
      {labels.length ? (
        <div className="row-between" style={{ marginTop: 8 }}>
          {labels.map((l) => (
            <span key={l} style={{ fontSize: "0.72rem", color: "var(--text-muted)" }}>
              {l}
            </span>
          ))}
        </div>
      ) : null}
    </div>
  );
}

export function Sparkline({
  points,
  color = "#2563eb",
  width = 84,
  height = 30
}: {
  points: number[];
  color?: string;
  width?: number;
  height?: number;
}) {
  const pts = pathFrom(points, width, height, 3);
  return (
    <svg width={width} height={height} viewBox={`0 0 ${width} ${height}`} aria-hidden style={{ flexShrink: 0 }}>
      <path d={smooth(pts)} fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" />
    </svg>
  );
}

export function GroupedBars({
  data,
  height = 200
}: {
  data: { label: string; committed: number; completed: number }[];
  height?: number;
}) {
  const w = 420;
  const h = height;
  const pad = 12;
  const base = h - 26;
  const max = Math.max(...data.flatMap((d) => [d.committed, d.completed])) || 1;
  const slot = (w - pad * 2) / data.length;
  const barW = 9;

  return (
    <div className="chart-wrap">
      <svg viewBox={`0 0 ${w} ${h}`} role="img" aria-label="Committed versus completed points by sprint">
        {data.map((d, i) => {
          const cx = pad + slot * i + slot / 2;
          const hc = (d.committed / max) * (base - pad);
          const hd = (d.completed / max) * (base - pad);
          return (
            <g key={d.label}>
              <rect x={cx - barW - 2} y={base - hc} width={barW} height={hc} rx="3" fill="#cbd5e1" />
              <rect x={cx + 2} y={base - hd} width={barW} height={hd} rx="3" fill="#2563eb" />
              <text x={cx} y={h - 8} textAnchor="middle" className="chart-axis">
                {d.label}
              </text>
            </g>
          );
        })}
      </svg>
    </div>
  );
}

export function Donut({
  segments,
  size = 150,
  thickness = 22,
  centerLabel,
  centerSub
}: {
  segments: { label: string; value: number; color: string }[];
  size?: number;
  thickness?: number;
  centerLabel?: string;
  centerSub?: string;
}) {
  const total = segments.reduce((s, x) => s + x.value, 0) || 1;
  const r = (size - thickness) / 2;
  const c = 2 * Math.PI * r;

  // Arc offsets are precomputed rather than accumulated inside map() so the
  // render stays a pure transform of props (no mutation mid-render).
  const arcs = segments.reduce<{ label: string; color: string; len: number; offset: number }[]>((acc, s) => {
    const prev = acc[acc.length - 1];
    const offset = prev ? prev.offset + prev.len : 0;
    acc.push({ label: s.label, color: s.color, len: (s.value / total) * c, offset });
    return acc;
  }, []);

  return (
    <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} role="img" aria-label="Breakdown by category">
      <g transform={`rotate(-90 ${size / 2} ${size / 2})`}>
        {arcs.map((a) => (
          <circle
            key={a.label}
            cx={size / 2}
            cy={size / 2}
            r={r}
            fill="none"
            stroke={a.color}
            strokeWidth={thickness}
            strokeDasharray={`${a.len} ${c - a.len}`}
            strokeDashoffset={-a.offset}
          />
        ))}
      </g>
      {centerLabel ? (
        <text
          x={size / 2}
          y={size / 2 - 2}
          textAnchor="middle"
          style={{ fontSize: 22, fontWeight: 700, fill: "var(--text-primary)" }}
        >
          {centerLabel}
        </text>
      ) : null}
      {centerSub ? (
        <text
          x={size / 2}
          y={size / 2 + 16}
          textAnchor="middle"
          style={{ fontSize: 10, fill: "var(--text-muted)" }}
        >
          {centerSub}
        </text>
      ) : null}
    </svg>
  );
}

/** Static architecture graph — nodes positioned in percentage space. */
export function ServiceMap({
  nodes,
  edges
}: {
  nodes: { id: string; label: string; x: number; y: number; tone: string; primary?: boolean }[];
  edges: [string, string][] | string[][];
}) {
  const w = 620;
  const h = 340;
  const nw = 108;
  const nh = 40;
  const pos = (n: { x: number; y: number }) => ({
    x: (n.x / 100) * (w - nw),
    y: (n.y / 100) * (h - nh)
  });
  const byId = new Map(nodes.map((n) => [n.id, n]));
  const dot: Record<string, string> = { green: "#10b981", amber: "#f59e0b", red: "#ef4444" };

  return (
    <div className="chart-wrap">
      <svg viewBox={`0 0 ${w} ${h}`} role="img" aria-label="Microservice dependency map">
        {edges.map(([a, b], i) => {
          const na = byId.get(a);
          const nb = byId.get(b);
          if (!na || !nb) return null;
          const pa = pos(na);
          const pb = pos(nb);
          const x1 = pa.x + nw;
          const y1 = pa.y + nh / 2;
          const x2 = pb.x;
          const y2 = pb.y + nh / 2;
          const mx = (x1 + x2) / 2;
          return (
            <path
              key={i}
              d={`M ${x1} ${y1} C ${mx} ${y1}, ${mx} ${y2}, ${x2} ${y2}`}
              fill="none"
              stroke="currentColor"
              strokeOpacity="0.18"
              strokeWidth="1.5"
            />
          );
        })}
        {nodes.map((n) => {
          const p = pos(n);
          return (
            <g key={n.id}>
              <rect
                x={p.x}
                y={p.y}
                width={nw}
                height={nh}
                rx="10"
                fill="var(--bg-elevated)"
                stroke={n.primary ? "#2563eb" : "var(--border)"}
                strokeWidth={n.primary ? 1.6 : 1}
              />
              <text
                x={p.x + 14}
                y={p.y + nh / 2 + 4}
                style={{ fontSize: 11, fontWeight: 600, fill: "var(--text-primary)" }}
              >
                {n.label}
              </text>
              <circle cx={p.x + nw - 13} cy={p.y + nh / 2} r="3.5" fill={dot[n.tone] ?? "#94a3b8"} />
            </g>
          );
        })}
      </svg>
    </div>
  );
}
