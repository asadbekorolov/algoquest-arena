import { useEffect, useRef, useState } from 'react';
import { Footprints, Loader2, Play, RotateCcw, StepForward, Timer, Zap } from 'lucide-react';
import type { Frame, RunResult, Scene } from '../types';
import { initialFrame } from './judge';

interface Props {
  /** Dastur ishga tushirilmagan paytda ko'rsatiladigan sahna */
  scene: Scene;
  result: RunResult | null;
  /** Har bir yangi natija yoki tiklashda ortadi */
  runToken: number;
  startMode: 'play' | 'step';
  busy: boolean;
  energyUnit: string;
  onRun(mode: 'play' | 'step'): void;
  onReset(): void;
  onPlaybackEnd(): void;
}

interface Particle {
  x: number;
  y: number;
  vx: number;
  vy: number;
  life: number;
  max: number;
  color: string;
  size: number;
}

interface PlayState {
  scene: Scene;
  frames: Frame[];
  pos: number;
  target: number;
  fired: number;
  ended: boolean;
  hasRun: boolean;
  speed: number;
  particles: Particle[];
  flashAt: number;
}

const C = {
  bg: '#090D16',
  floor: '#0D1422',
  floorEdge: '#182132',
  wall: '#172033',
  wallEdge: '#273247',
  neon: '#10B981',
  amber: '#F59E0B',
  red: '#EF4444',
};

const STEP_SECONDS = 0.3;
const ease = (t: number) => (t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2);

function rr(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number): void {
  const q = Math.min(r, w / 2, h / 2);
  ctx.beginPath();
  ctx.moveTo(x + q, y);
  ctx.arcTo(x + w, y, x + w, y + h, q);
  ctx.arcTo(x + w, y + h, x, y + h, q);
  ctx.arcTo(x, y + h, x, y, q);
  ctx.arcTo(x, y, x + w, y, q);
  ctx.closePath();
}

function burst(s: PlayState, x: number, y: number, color: string, count: number, power: number): void {
  for (let i = 0; i < count; i++) {
    const a = Math.random() * Math.PI * 2;
    const v = (0.6 + Math.random() * 1.6) * power;
    const max = 0.5 + Math.random() * 0.6;
    s.particles.push({ x, y, vx: Math.cos(a) * v, vy: Math.sin(a) * v, life: max, max, color, size: 0.04 + Math.random() * 0.07 });
  }
}

function draw(ctx: CanvasRenderingContext2D, W: number, H: number, s: PlayState, now: number): void {
  const sc = s.scene;
  const time = now / 1000;
  const pad = 16;
  const ts = Math.min((W - pad * 2) / sc.cols, (H - pad * 2) / sc.rows);
  const ox = (W - ts * sc.cols) / 2;
  const oy = (H - ts * sc.rows) / 2;
  const cx = (x: number) => ox + (x + 0.5) * ts;
  const cy = (y: number) => oy + (y + 0.5) * ts;

  ctx.fillStyle = C.bg;
  ctx.fillRect(0, 0, W, H);
  const bgGlow = ctx.createRadialGradient(W / 2, H / 2, 0, W / 2, H / 2, Math.max(W, H) * 0.7);
  bgGlow.addColorStop(0, 'rgba(16,185,129,0.05)');
  bgGlow.addColorStop(1, 'rgba(9,13,22,0)');
  ctx.fillStyle = bgGlow;
  ctx.fillRect(0, 0, W, H);

  const last = s.frames.length - 1;
  const i = Math.min(Math.floor(s.pos + 1e-9), last);
  const a = s.frames[i];
  const b = s.frames[Math.min(i + 1, last)];
  const t = ease(Math.min(1, Math.max(0, s.pos - i)));
  const ax = a.x + (b.x - a.x) * t;
  const ay = a.y + (b.y - a.y) * t;
  let da = b.angle - a.angle;
  while (da > Math.PI) da -= Math.PI * 2;
  while (da < -Math.PI) da += Math.PI * 2;
  const ang = a.angle + da * t;

  if (sc.kind === 'grid') {
    const g = Math.max(1, ts * 0.04);
    for (let y = 0; y < sc.rows; y++) {
      for (let x = 0; x < sc.cols; x++) {
        const wall = sc.tiles[y][x] === '#';
        rr(ctx, ox + x * ts + g, oy + y * ts + g, ts - 2 * g, ts - 2 * g, ts * 0.2);
        ctx.fillStyle = wall ? C.wall : C.floor;
        ctx.fill();
        ctx.lineWidth = 1;
        ctx.strokeStyle = wall ? C.wallEdge : C.floorEdge;
        ctx.stroke();
        if (wall) {
          rr(ctx, ox + x * ts + ts * 0.3, oy + y * ts + ts * 0.3, ts * 0.4, ts * 0.4, ts * 0.1);
          ctx.fillStyle = 'rgba(39,50,71,0.55)';
          ctx.fill();
        }
      }
    }
    for (const l of sc.labels) {
      rr(ctx, ox + l.x * ts + ts * 0.1, oy + l.y * ts + ts * 0.1, ts * 0.8, ts * 0.8, ts * 0.18);
      ctx.fillStyle = 'rgba(245,158,11,0.08)';
      ctx.fill();
      ctx.strokeStyle = 'rgba(245,158,11,0.45)';
      ctx.lineWidth = 1.2;
      ctx.stroke();
      const size = Math.max(9, ts * (l.text.length > 3 ? 0.24 : 0.34));
      ctx.font = `600 ${size}px "JetBrains Mono","Cascadia Code",Consolas,monospace`;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillStyle = '#FCD34D';
      ctx.fillText(l.text, cx(l.x), cy(l.y) + 1);
    }
  } else {
    ctx.fillStyle = 'rgba(31,41,55,0.9)';
    for (let y = 0; y < sc.rows; y++)
      for (let x = 0; x < sc.cols; x++) {
        ctx.beginPath();
        ctx.arc(cx(x), cy(y), 1.2, 0, Math.PI * 2);
        ctx.fill();
      }
    ctx.lineCap = 'round';
    for (const [u, v] of sc.edges) {
      ctx.beginPath();
      ctx.moveTo(cx(sc.nodes[u].x), cy(sc.nodes[u].y));
      ctx.lineTo(cx(sc.nodes[v].x), cy(sc.nodes[v].y));
      ctx.strokeStyle = '#27324A';
      ctx.lineWidth = Math.max(1.5, ts * 0.05);
      ctx.stroke();
    }
  }

  // Bosib o'tilgan yo'l izi
  if (s.hasRun && (i > 0 || s.pos > 0)) {
    ctx.beginPath();
    ctx.moveTo(cx(s.frames[0].x), cy(s.frames[0].y));
    for (let k = 1; k <= i; k++) ctx.lineTo(cx(s.frames[k].x), cy(s.frames[k].y));
    ctx.lineTo(cx(ax), cy(ay));
    ctx.strokeStyle = 'rgba(16,185,129,0.3)';
    ctx.lineWidth = Math.max(2, ts * 0.1);
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    ctx.stroke();
  }

  if (sc.kind === 'graph') {
    const r = Math.max(8, ts * 0.3);
    sc.nodes.forEach((nd, idx) => {
      const isStart = nd.x === sc.start.x && nd.y === sc.start.y;
      ctx.beginPath();
      ctx.arc(cx(nd.x), cy(nd.y), r, 0, Math.PI * 2);
      ctx.fillStyle = '#111827';
      ctx.fill();
      ctx.lineWidth = 1.6;
      ctx.strokeStyle = isStart ? C.neon : '#3B4863';
      ctx.stroke();
      ctx.font = `600 ${Math.max(9, r * 0.9)}px "JetBrains Mono","Cascadia Code",Consolas,monospace`;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillStyle = '#CBD5E1';
      ctx.fillText(String(idx), cx(nd.x), cy(nd.y) + 1);
    });
  }

  // Lazer darvozalari
  for (const l of sc.lasers) {
    const active = (a.tick + l.phase) % l.period < l.on;
    const x = cx(l.x);
    const y0 = oy + l.y * ts + ts * 0.1;
    const y1 = oy + (l.y + 1) * ts - ts * 0.1;
    ctx.save();
    ctx.fillStyle = active ? C.red : '#3A4458';
    rr(ctx, x - ts * 0.11, y0 - ts * 0.04, ts * 0.22, ts * 0.12, 2);
    ctx.fill();
    rr(ctx, x - ts * 0.11, y1 - ts * 0.08, ts * 0.22, ts * 0.12, 2);
    ctx.fill();
    ctx.beginPath();
    ctx.moveTo(x, y0 + ts * 0.06);
    ctx.lineTo(x, y1 - ts * 0.06);
    if (active) {
      ctx.shadowColor = C.red;
      ctx.shadowBlur = 16;
      ctx.strokeStyle = `rgba(239,68,68,${0.75 + 0.25 * Math.sin(time * 22)})`;
      ctx.lineWidth = Math.max(2.5, ts * 0.09);
    } else {
      ctx.setLineDash([3, 5]);
      ctx.strokeStyle = 'rgba(239,68,68,0.22)';
      ctx.lineWidth = 1.5;
    }
    ctx.stroke();
    ctx.restore();
  }

  // Portal
  if (sc.portal) {
    const px = cx(sc.portal.x);
    const py = cy(sc.portal.y);
    const r = ts * 0.36;
    const glow = ctx.createRadialGradient(px, py, 0, px, py, r * 1.9);
    glow.addColorStop(0, 'rgba(16,185,129,0.4)');
    glow.addColorStop(1, 'rgba(16,185,129,0)');
    ctx.fillStyle = glow;
    ctx.beginPath();
    ctx.arc(px, py, r * 1.9, 0, Math.PI * 2);
    ctx.fill();
    ctx.save();
    ctx.translate(px, py);
    ctx.lineCap = 'round';
    ctx.shadowColor = C.neon;
    ctx.shadowBlur = 12;
    for (let k = 0; k < 3; k++) {
      ctx.save();
      ctx.rotate(time * (k % 2 ? -1.3 : 0.9) + k * 2.1);
      ctx.beginPath();
      ctx.arc(0, 0, r * (1 - k * 0.27), 0, Math.PI * 1.25);
      ctx.strokeStyle = k === 1 ? '#6EE7B7' : C.neon;
      ctx.lineWidth = Math.max(1.5, ts * 0.06);
      ctx.stroke();
      ctx.restore();
    }
    ctx.restore();
  }

  // Energiya kristallari
  sc.crystals.forEach((c, idx) => {
    if (a.mask & (1 << idx)) return;
    const px = cx(c.x);
    const py = cy(c.y) + Math.sin(time * 2.4 + idx) * ts * 0.05;
    const r = ts * 0.2;
    ctx.save();
    ctx.shadowColor = C.amber;
    ctx.shadowBlur = 14;
    ctx.beginPath();
    ctx.moveTo(px, py - r * 1.25);
    ctx.lineTo(px + r, py);
    ctx.lineTo(px, py + r * 1.25);
    ctx.lineTo(px - r, py);
    ctx.closePath();
    ctx.fillStyle = C.amber;
    ctx.fill();
    ctx.shadowBlur = 0;
    ctx.beginPath();
    ctx.moveTo(px, py - r * 1.25);
    ctx.lineTo(px + r, py);
    ctx.lineTo(px, py);
    ctx.closePath();
    ctx.fillStyle = 'rgba(254,243,199,0.55)';
    ctx.fill();
    ctx.restore();
  });

  // Kiber-agent
  const flashAge = (now - s.flashAt) / 800;
  const flashing = flashAge >= 0 && flashAge < 1;
  const px = cx(ax);
  const py = cy(ay);
  const r = ts * (sc.kind === 'graph' ? 0.22 : 0.3);
  ctx.save();
  ctx.translate(px, py);
  ctx.beginPath();
  ctx.arc(0, 0, r * (1.5 + 0.12 * Math.sin(time * 4)), 0, Math.PI * 2);
  ctx.strokeStyle = flashing ? 'rgba(239,68,68,0.5)' : 'rgba(16,185,129,0.28)';
  ctx.lineWidth = 1.5;
  ctx.stroke();
  ctx.rotate(ang);
  ctx.shadowColor = flashing ? C.red : C.neon;
  ctx.shadowBlur = 20;
  rr(ctx, -r, -r, r * 2, r * 2, r * 0.5);
  ctx.fillStyle = flashing ? C.red : C.neon;
  ctx.fill();
  ctx.shadowBlur = 0;
  rr(ctx, -r * 0.72, -r * 0.72, r * 1.44, r * 1.44, r * 0.34);
  ctx.fillStyle = flashing ? '#450A0A' : '#052E22';
  ctx.fill();
  ctx.beginPath();
  ctx.moveTo(r * 0.56, 0);
  ctx.lineTo(-r * 0.2, -r * 0.4);
  ctx.lineTo(-r * 0.04, 0);
  ctx.lineTo(-r * 0.2, r * 0.4);
  ctx.closePath();
  ctx.fillStyle = flashing ? '#FECACA' : '#D1FAE5';
  ctx.fill();
  ctx.restore();

  if (flashing) {
    ctx.save();
    ctx.translate(px, py);
    ctx.beginPath();
    for (let k = 0; k < 6; k++) {
      const an = (k / 6) * Math.PI * 2 + Math.PI / 6;
      const rad = r * (1.6 + flashAge * 2.4);
      if (k === 0) ctx.moveTo(Math.cos(an) * rad, Math.sin(an) * rad);
      else ctx.lineTo(Math.cos(an) * rad, Math.sin(an) * rad);
    }
    ctx.closePath();
    ctx.strokeStyle = `rgba(239,68,68,${1 - flashAge})`;
    ctx.lineWidth = 3;
    ctx.shadowColor = C.red;
    ctx.shadowBlur = 18;
    ctx.stroke();
    ctx.restore();
    ctx.fillStyle = `rgba(239,68,68,${0.16 * (1 - flashAge)})`;
    ctx.fillRect(0, 0, W, H);
  }

  // Zarrachalar
  for (const p of s.particles) {
    const alpha = Math.max(0, p.life / p.max);
    ctx.globalAlpha = alpha;
    ctx.fillStyle = p.color;
    const size = p.size * ts * (0.5 + alpha);
    rr(ctx, cx(p.x) - size / 2, cy(p.y) - size / 2, size, size, size * 0.3);
    ctx.fill();
  }
  ctx.globalAlpha = 1;
}

export default function ArenaCanvas({ scene, result, runToken, startMode, busy, energyUnit, onRun, onReset, onPlaybackEnd }: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const st = useRef<PlayState>({
    scene,
    frames: [initialFrame(scene)],
    pos: 0,
    target: 0,
    fired: 0,
    ended: true,
    hasRun: false,
    speed: 1,
    particles: [],
    flashAt: -1e9,
  });
  const [speed, setSpeed] = useState(1);
  const [hud, setHud] = useState({ energy: 1, steps: 0, done: false });
  const endRef = useRef(onPlaybackEnd);
  endRef.current = onPlaybackEnd;

  useEffect(() => {
    const s = st.current;
    if (result) {
      s.scene = result.scene;
      s.frames = result.frames.length ? result.frames : [initialFrame(result.scene)];
      s.hasRun = true;
      s.target = startMode === 'play' ? s.frames.length - 1 : 0;
      s.ended = false;
    } else {
      s.scene = scene;
      s.frames = [initialFrame(scene)];
      s.hasRun = false;
      s.target = 0;
      s.ended = true;
    }
    s.pos = 0;
    s.fired = 0;
    s.particles = [];
    s.flashAt = -1e9;
    setHud({ energy: 1, steps: 0, done: false });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [runToken, scene]);

  useEffect(() => {
    st.current.speed = speed;
  }, [speed]);

  useEffect(() => {
    let raf = 0;
    let lastT = performance.now();
    const fire = (s: PlayState, f: Frame, now: number) => {
      if (f.event === 'crystal') burst(s, f.x, f.y, C.amber, 16, 1);
      else if (f.event === 'portal') {
        burst(s, f.x, f.y, C.neon, 46, 1.7);
        burst(s, f.x, f.y, '#A7F3D0', 18, 1.1);
      } else if (f.event === 'crash' || f.event === 'tle' || f.event === 'fail') {
        s.flashAt = now;
        burst(s, f.x, f.y, C.red, f.event === 'fail' ? 12 : 26, 1.3);
      }
    };
    const loop = (now: number) => {
      const dt = Math.min(0.3, (now - lastT) / 1000);
      lastT = now;
      const s = st.current;
      const canvas = canvasRef.current;
      if (canvas) {
        if (s.pos < s.target) {
          s.pos = Math.min(s.target, s.pos + (dt * s.speed) / STEP_SECONDS);
          const reached = Math.floor(s.pos + 1e-9);
          let changed = false;
          while (s.fired < reached) {
            s.fired++;
            fire(s, s.frames[s.fired], now);
            changed = true;
          }
          if (changed) {
            const f = s.frames[s.fired];
            setHud({ energy: f.energy, steps: f.steps, done: s.fired >= s.frames.length - 1 });
          }
        }
        if (!s.ended && s.hasRun && s.pos >= s.frames.length - 1) {
          s.ended = true;
          const f = s.frames[s.frames.length - 1];
          setHud({ energy: f.energy, steps: f.steps, done: true });
          endRef.current();
        }
        for (const p of s.particles) {
          p.x += p.vx * dt;
          p.y += p.vy * dt;
          p.vx *= 0.94;
          p.vy *= 0.94;
          p.life -= dt;
        }
        if (s.particles.length) s.particles = s.particles.filter((p) => p.life > 0);

        const dpr = Math.min(2, window.devicePixelRatio || 1);
        const cw = canvas.clientWidth;
        const ch = canvas.clientHeight;
        if (cw > 0 && ch > 0) {
          const pw = Math.round(cw * dpr);
          const ph = Math.round(ch * dpr);
          if (canvas.width !== pw || canvas.height !== ph) {
            canvas.width = pw;
            canvas.height = ph;
          }
          const ctx = canvas.getContext('2d');
          if (ctx) {
            ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
            draw(ctx, cw, ch, s, now);
          }
        }
      }
      raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(raf);
  }, []);

  const handleStep = () => {
    const s = st.current;
    if (!s.hasRun) {
      onRun('step');
      return;
    }
    const last = s.frames.length - 1;
    if (s.pos >= last) return;
    s.target = Math.min(last, Math.floor(s.pos + 1e-6) + 1);
  };

  const pct = Math.round(hud.energy * 100);
  const barColor = hud.energy > 0.35 ? 'bg-neon' : hud.energy > 0.15 ? 'bg-ember' : 'bg-danger';
  const caption = (result?.scene ?? scene).caption;
  const finished = result !== null && hud.done;

  return (
    <div className="flex flex-col gap-3">
      <div className="relative overflow-hidden rounded-2xl border border-edge bg-obsidian">
        <canvas ref={canvasRef} className="block aspect-[16/10] w-full" />
        <div className="pointer-events-none absolute inset-x-0 top-0 flex flex-wrap items-stretch gap-2 p-3">
          <div className="min-w-[190px] flex-1 rounded-xl border border-edge bg-panel/85 px-3 py-2 backdrop-blur">
            <div className="flex items-center justify-between gap-2 text-[11px] font-medium text-slate-400">
              <span className="flex items-center gap-1.5">
                <Zap className="h-3.5 w-3.5 text-ember" />
                Energiya (Big-O byudjeti)
              </span>
              <span className="font-mono text-slate-200">{pct}%</span>
            </div>
            <div className="mt-1.5 h-2 overflow-hidden rounded-full bg-edge">
              <div className={`h-full rounded-full transition-[width] duration-200 ${barColor}`} style={{ width: `${pct}%` }} />
            </div>
            {finished && result && (
              <div className="mt-1 font-mono text-[10px] text-slate-500">
                {result.energyUsed.toLocaleString('uz')} / {result.energyBudget.toLocaleString('uz')} {energyUnit}
              </div>
            )}
          </div>
          <div className="rounded-xl border border-edge bg-panel/85 px-3 py-2 backdrop-blur">
            <div className="flex items-center gap-1.5 text-[11px] font-medium text-slate-400">
              <Footprints className="h-3.5 w-3.5 text-neon" />
              Qadamlar soni
            </div>
            <div className="mt-0.5 font-mono text-sm text-slate-100">{hud.steps}</div>
          </div>
          <div className="rounded-xl border border-edge bg-panel/85 px-3 py-2 backdrop-blur">
            <div className="flex items-center gap-1.5 text-[11px] font-medium text-slate-400">
              <Timer className="h-3.5 w-3.5 text-neon" />
              Bajarilish vaqti (ms)
            </div>
            <div className="mt-0.5 font-mono text-sm text-slate-100">{result ? result.timeMs.toFixed(1) : '0.0'}</div>
          </div>
        </div>
        {caption && (
          <div className="pointer-events-none absolute bottom-3 left-3 rounded-lg border border-edge bg-panel/85 px-2.5 py-1 text-[11px] text-slate-300 backdrop-blur">
            {caption}
          </div>
        )}
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <button
          type="button"
          onClick={() => onRun('play')}
          disabled={busy}
          className="flex items-center gap-2 rounded-2xl bg-neon px-4 py-2.5 text-sm font-semibold text-obsidian transition hover:brightness-110 disabled:opacity-60"
        >
          {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Play className="h-4 w-4" />}
          Kodni Ishga Tushirish
        </button>
        <button
          type="button"
          onClick={handleStep}
          disabled={busy}
          className="flex items-center gap-2 rounded-2xl border border-edge bg-panel px-4 py-2.5 text-sm font-medium text-slate-200 transition hover:border-neon/60 disabled:opacity-60"
        >
          <StepForward className="h-4 w-4 text-neon" />
          Qadamma-qadam
        </button>
        <button
          type="button"
          onClick={onReset}
          disabled={busy}
          className="flex items-center gap-2 rounded-2xl border border-edge bg-panel px-4 py-2.5 text-sm font-medium text-slate-200 transition hover:border-ember/60 disabled:opacity-60"
        >
          <RotateCcw className="h-4 w-4 text-ember" />
          Qayta Tiklash
        </button>
        <div className="ml-auto flex items-center gap-1 rounded-2xl border border-edge bg-panel p-1" role="group" aria-label="Animatsiya tezligi">
          {[1, 2, 4].map((v) => (
            <button
              key={v}
              type="button"
              onClick={() => setSpeed(v)}
              className={`rounded-xl px-3 py-1.5 font-mono text-xs font-semibold transition ${
                speed === v ? 'bg-neon/15 text-neon' : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              {v}x
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
