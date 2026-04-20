import { useEffect, useRef } from "react";
import { ArrowRight } from "lucide-react";
import { Button } from "@/components/ui/button";

// ─── Types ────────────────────────────────────────────────────────────────────

interface Star {
  x: number; y: number; r: number;
  baseOpacity: number; speed: number; phase: number;
  color: string;
}

interface Symbol {
  x: number; y: number; size: number;
  rotation: number; rotSpeed: number;
  opacity: number; targetOpacity: number; fadeSpeed: number;
  type: "triangle" | "hexagon" | "ring" | "cross" | "diamond";
  color: string;
}

// ─── Canvas component ─────────────────────────────────────────────────────────

const GalaxyCanvas = () => {
  const ref = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = ref.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    let raf: number;
    let stars: Star[] = [];
    let symbols: Symbol[] = [];

    const STAR_COLORS = ["#ffffff", "#e8e0ff", "#d4c5ff", "#fff5cc", "#c5d9ff"];
    const SYM_COLORS  = [
      "rgba(190,160,255,",
      "rgba(210,190,255,",
      "rgba(255,220,180,",
      "rgba(160,210,255,",
    ];
    const SYM_TYPES: Symbol["type"][] = ["triangle","hexagon","ring","cross","diamond"];

    // ── Setup ─────────────────────────────────────────────────────────────────

    const init = () => {
      canvas.width  = canvas.offsetWidth;
      canvas.height = canvas.offsetHeight;

      // Stars: roughly 1 per 2 500 px²
      const n = Math.floor((canvas.width * canvas.height) / 2500);
      stars = Array.from({ length: n }, () => ({
        x: Math.random() * canvas.width,
        y: Math.random() * canvas.height,
        r: Math.random() * 1.6 + 0.2,
        baseOpacity: Math.random() * 0.65 + 0.25,
        speed: Math.random() * 0.018 + 0.004,
        phase: Math.random() * Math.PI * 2,
        color: STAR_COLORS[Math.floor(Math.random() * STAR_COLORS.length)],
      }));

      // Light-language symbols: sparse, spread over canvas
      symbols = Array.from({ length: 18 }, () => {
        const base = Math.random() * 0.12;
        return {
          x: Math.random() * canvas.width,
          y: Math.random() * canvas.height,
          size: Math.random() * 50 + 18,
          rotation: Math.random() * Math.PI * 2,
          rotSpeed: (Math.random() - 0.5) * 0.0015,
          opacity: 0,
          targetOpacity: base,
          fadeSpeed: Math.random() * 0.0015 + 0.0005,
          type: SYM_TYPES[Math.floor(Math.random() * SYM_TYPES.length)],
          color: SYM_COLORS[Math.floor(Math.random() * SYM_COLORS.length)],
        };
      });
    };

    // ── Draw helpers ──────────────────────────────────────────────────────────

    const drawNebulaLayer = (time: number) => {
      // Slow-drifting ambient glow blobs
      const blobs = [
        { x: 0.25, y: 0.35, r: 0.38, c: "rgba(82,40,150," },
        { x: 0.72, y: 0.55, r: 0.30, c: "rgba(40,60,160," },
        { x: 0.50, y: 0.80, r: 0.25, c: "rgba(100,30,120," },
      ];
      blobs.forEach(({ x, y, r, c }, i) => {
        const drift = Math.sin(time * 0.00015 + i) * 20;
        const cx = x * canvas.width  + drift;
        const cy = y * canvas.height + drift * 0.5;
        const rx = r * Math.min(canvas.width, canvas.height);
        const g  = ctx.createRadialGradient(cx, cy, 0, cx, cy, rx);
        g.addColorStop(0,   c + "0.18)");
        g.addColorStop(0.5, c + "0.07)");
        g.addColorStop(1,   c + "0)");
        ctx.beginPath();
        ctx.arc(cx, cy, rx, 0, Math.PI * 2);
        ctx.fillStyle = g;
        ctx.globalAlpha = 1;
        ctx.fill();
      });
    };

    const drawStar = (s: Star, time: number) => {
      const tw = Math.sin(time * s.speed + s.phase);
      const op = s.baseOpacity * (0.55 + 0.45 * tw);
      ctx.globalAlpha = op;
      ctx.beginPath();
      ctx.arc(s.x, s.y, s.r, 0, Math.PI * 2);
      ctx.fillStyle = s.color;
      ctx.fill();
      // Halo on bigger stars
      if (s.r > 1.1) {
        const g = ctx.createRadialGradient(s.x, s.y, 0, s.x, s.y, s.r * 5);
        g.addColorStop(0,   "rgba(255,255,255,0.12)");
        g.addColorStop(1,   "rgba(255,255,255,0)");
        ctx.beginPath();
        ctx.arc(s.x, s.y, s.r * 5, 0, Math.PI * 2);
        ctx.fillStyle = g;
        ctx.globalAlpha = op * 0.5;
        ctx.fill();
      }
    };

    const polygon = (sides: number, size: number) => {
      ctx.beginPath();
      for (let i = 0; i < sides; i++) {
        const a = (i / sides) * Math.PI * 2 - Math.PI / 2;
        i === 0 ? ctx.moveTo(Math.cos(a) * size, Math.sin(a) * size)
                : ctx.lineTo(Math.cos(a) * size, Math.sin(a) * size);
      }
      ctx.closePath();
    };

    const drawSymbol = (s: Symbol) => {
      if (s.opacity < 0.001) return;
      ctx.save();
      ctx.translate(s.x, s.y);
      ctx.rotate(s.rotation);
      ctx.strokeStyle = s.color + s.opacity + ")";
      ctx.lineWidth   = 0.8;
      ctx.globalAlpha = 1;

      switch (s.type) {
        case "triangle":
          polygon(3, s.size);
          ctx.stroke();
          // inner triangle inverted
          ctx.rotate(Math.PI);
          polygon(3, s.size * 0.55);
          ctx.stroke();
          break;
        case "hexagon":
          polygon(6, s.size);
          ctx.stroke();
          polygon(6, s.size * 0.5);
          ctx.stroke();
          break;
        case "ring":
          ctx.beginPath();
          ctx.arc(0, 0, s.size,      0, Math.PI * 2);
          ctx.stroke();
          ctx.beginPath();
          ctx.arc(0, 0, s.size * 0.6, 0, Math.PI * 2);
          ctx.stroke();
          // four dot markers
          for (let i = 0; i < 4; i++) {
            const a = (i / 4) * Math.PI * 2;
            ctx.beginPath();
            ctx.arc(Math.cos(a) * s.size, Math.sin(a) * s.size, 2, 0, Math.PI * 2);
            ctx.fillStyle = s.color + s.opacity + ")";
            ctx.fill();
          }
          break;
        case "cross":
          ctx.beginPath();
          ctx.moveTo(-s.size, 0); ctx.lineTo(s.size, 0);
          ctx.moveTo(0, -s.size); ctx.lineTo(0, s.size);
          ctx.stroke();
          // diagonal arms thinner
          ctx.lineWidth = 0.4;
          ctx.beginPath();
          ctx.moveTo(-s.size * 0.7, -s.size * 0.7); ctx.lineTo(s.size * 0.7, s.size * 0.7);
          ctx.moveTo( s.size * 0.7, -s.size * 0.7); ctx.lineTo(-s.size * 0.7, s.size * 0.7);
          ctx.stroke();
          break;
        case "diamond":
          ctx.beginPath();
          ctx.moveTo(0, -s.size);
          ctx.lineTo(s.size * 0.55, 0);
          ctx.lineTo(0,  s.size);
          ctx.lineTo(-s.size * 0.55, 0);
          ctx.closePath();
          ctx.stroke();
          ctx.beginPath();
          ctx.arc(0, 0, s.size * 0.2, 0, Math.PI * 2);
          ctx.stroke();
          break;
      }
      ctx.restore();
    };

    // ── Animation loop ────────────────────────────────────────────────────────

    const tick = (time: number) => {
      ctx.clearRect(0, 0, canvas.width, canvas.height);

      // 1. nebula glow
      drawNebulaLayer(time);

      // 2. stars
      ctx.globalAlpha = 1;
      stars.forEach(s => drawStar(s, time));

      // 3. light language symbols — fade in/out slowly
      symbols.forEach(s => {
        // drift opacity toward target
        if (Math.abs(s.opacity - s.targetOpacity) < s.fadeSpeed) {
          // reached target — pick a new one
          s.targetOpacity = Math.random() < 0.5 ? Math.random() * 0.12 : 0;
        } else {
          s.opacity += s.opacity < s.targetOpacity ? s.fadeSpeed : -s.fadeSpeed;
        }
        s.rotation += s.rotSpeed;
        drawSymbol(s);
      });

      ctx.globalAlpha = 1;
      raf = requestAnimationFrame(tick);
    };

    const ro = new ResizeObserver(() => { init(); });
    ro.observe(canvas);
    init();
    raf = requestAnimationFrame(tick);

    return () => {
      cancelAnimationFrame(raf);
      ro.disconnect();
    };
  }, []);

  return (
    <canvas
      ref={ref}
      className="absolute inset-0 h-full w-full"
      style={{ display: "block" }}
    />
  );
};

// ─── Hero ─────────────────────────────────────────────────────────────────────

export const Hero = () => {
  return (
    <section className="relative w-full min-h-screen overflow-hidden bg-[#0d0820]">
      <GalaxyCanvas />

      {/* Vignette */}
      <div className="pointer-events-none absolute inset-0 bg-radial-[ellipse_at_center] from-transparent via-transparent to-black/50" />

      {/* Content */}
      <div className="relative z-10 flex min-h-screen flex-col items-center justify-center px-6 pt-24 pb-16 text-center text-white">
        <h1 className="max-w-4xl text-4xl font-bold tracking-tight drop-shadow-lg md:text-5xl lg:text-6xl xl:text-7xl">
          Zelfbewustzijn, eigenheid en vrijheid
        </h1>
        <p className="mt-6 max-w-2xl text-lg text-white/80 drop-shadow md:text-xl">
          Boeken · Kaarten · Cursussen · Workshops · Consulten
        </p>
        <div className="mt-10 flex flex-wrap items-center justify-center gap-4">
          <Button
            size="lg"
            className="rounded-xl bg-primary px-8 text-primary-foreground shadow-lg hover:bg-primary/90"
            asChild
          >
            <a href="/shop">Webshop</a>
          </Button>
          <Button
            size="lg"
            variant="outline"
            className="rounded-xl border-white/30 bg-white/10 px-8 text-white backdrop-blur-sm hover:bg-white/20"
            asChild
          >
            <a href="/about">
              Over Petra <ArrowRight className="ml-1 size-4" />
            </a>
          </Button>
        </div>
      </div>
    </section>
  );
};
