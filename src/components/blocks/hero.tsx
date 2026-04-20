import { useEffect, useRef } from "react";
import { ArrowRight } from "lucide-react";
import { Button } from "@/components/ui/button";

const GalaxyCanvas = () => {
  const ref = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = ref.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    let raf: number;

    // ── Types ────────────────────────────────────────────────────────────────

    interface Star {
      x: number; y: number; r: number;
      op: number; speed: number; phase: number;
      color: string;
    }

    interface Shooter {
      x: number; y: number;
      vx: number; vy: number;
      len: number; life: number; maxLife: number;
      active: boolean;
    }

    // ── State ─────────────────────────────────────────────────────────────────

    let stars:   Star[]    = [];
    let shooter: Shooter   = { x:0,y:0,vx:0,vy:0,len:0,life:0,maxLife:0,active:false };
    let nextShot = 0;          // timestamp for next shooting star
    let galaxyLayer: HTMLCanvasElement | null = null;

    const STAR_COLS = [
      "#ffffff","#ffffff","#ffffff","#ffffff",
      "#ddeeff","#cce0ff","#aaccff",
      "#fff8e8","#ffeedd",
    ];

    // ── Build static Milky Way layer ──────────────────────────────────────────

    const buildMilkyWay = (w: number, h: number) => {
      const off = document.createElement("canvas");
      off.width = w; off.height = h;
      const c   = off.getContext("2d")!;

      // The band runs left→right, centred roughly at 55% height,
      // tilted slightly like the real Milky Way
      const bandY  = h * 0.52;
      const tilt   = h * 0.10;   // how much it rises from left to right edge

      const band = (
        yOff: number, thickness: number,
        r: number, g: number, b: number, alpha: number
      ) => {
        for (let x = 0; x <= w; x += w / 80) {
          const cy = bandY - tilt * (x / w - 0.5) * 2 + yOff;
          const grad = c.createRadialGradient(x, cy, 0, x, cy, thickness);
          grad.addColorStop(0,   `rgba(${r},${g},${b},${alpha})`);
          grad.addColorStop(0.5, `rgba(${r},${g},${b},${alpha * 0.4})`);
          grad.addColorStop(1,   "rgba(0,0,0,0)");
          c.beginPath();
          c.arc(x, cy, thickness, 0, Math.PI * 2);
          c.fillStyle = grad;
          c.fill();
        }
      };

      // Wide outer glow — deep blue
      band(0,   h * 0.32,  20,  35, 110, 0.18);
      // Mid layer — blue-purple
      band(0,   h * 0.20,  40,  30, 130, 0.22);
      // Inner bright core — blue-white + warm
      band(0,   h * 0.10,  90, 100, 180, 0.25);
      // Very bright spine — warm gold/white
      band(0,   h * 0.045, 230,210, 170, 0.30);

      // Emission nebulae — pinkish blobs scattered along band
      const emit = [0.18, 0.38, 0.55, 0.72, 0.88];
      emit.forEach((fx, i) => {
        const ex = fx * w;
        const ey = bandY - tilt * (fx - 0.5) * 2 + (i % 2 === 0 ? -h*0.04 : h*0.03);
        const er = h * (0.06 + (i % 3) * 0.03);
        const eg = c.createRadialGradient(ex, ey, 0, ex, ey, er);
        eg.addColorStop(0,   "rgba(180,80,140,0.22)");
        eg.addColorStop(0.5, "rgba(120,50,160,0.10)");
        eg.addColorStop(1,   "rgba(0,0,0,0)");
        c.beginPath(); c.arc(ex, ey, er, 0, Math.PI*2);
        c.fillStyle = eg; c.fill();
      });

      // Blue reflection nebulae
      const refl = [0.08, 0.30, 0.62, 0.82];
      refl.forEach((fx, i) => {
        const rx2 = fx * w;
        const ry2 = bandY - tilt*(fx-0.5)*2 + (i%2===0 ? h*0.05 : -h*0.06);
        const rr  = h * (0.05 + (i%2)*0.025);
        const rg  = c.createRadialGradient(rx2, ry2, 0, rx2, ry2, rr);
        rg.addColorStop(0,   "rgba(60,120,220,0.18)");
        rg.addColorStop(0.5, "rgba(40, 80,180,0.08)");
        rg.addColorStop(1,   "rgba(0,0,0,0)");
        c.beginPath(); c.arc(rx2, ry2, rr, 0, Math.PI*2);
        c.fillStyle = rg; c.fill();
      });

      // Dark dust lanes — slightly darker streaks within band for realism
      c.globalCompositeOperation = "multiply";
      const dustLanes = [0.25, 0.5, 0.75];
      dustLanes.forEach(fx => {
        const dx = fx * w;
        const dy = bandY - tilt*(fx-0.5)*2;
        const dg = c.createRadialGradient(dx, dy, 0, dx, dy, h*0.04);
        dg.addColorStop(0,   "rgba(0,0,10,0.45)");
        dg.addColorStop(1,   "rgba(0,0,0,0)");
        c.beginPath(); c.arc(dx, dy, h*0.04, 0, Math.PI*2);
        c.fillStyle = dg; c.fill();
      });
      c.globalCompositeOperation = "source-over";

      return off;
    };

    // ── Init stars ────────────────────────────────────────────────────────────

    const init = () => {
      canvas.width  = canvas.offsetWidth;
      canvas.height = canvas.offsetHeight;

      const w = canvas.width, h = canvas.height;
      const bandY = h * 0.52;
      const tilt  = h * 0.10;
      const total = Math.floor((w * h) / 650);

      stars = Array.from({ length: total }, () => {
        // Bias stars toward the band
        let x: number, y: number;
        if (Math.random() < 0.65) {
          // near the band
          x = Math.random() * w;
          const by = bandY - tilt * (x/w - 0.5) * 2;
          y = by + (Math.random() - 0.5) * h * 0.38;
        } else {
          x = Math.random() * w;
          y = Math.random() * h;
        }
        const bright = Math.random() < 0.03;
        return {
          x, y,
          r:     bright ? Math.random()*1.4+0.7 : Math.random()*0.55+0.08,
          op:    bright ? Math.random()*0.55+0.40 : Math.random()*0.30+0.08,
          speed: Math.random()*0.005+0.001,
          phase: Math.random()*Math.PI*2,
          color: STAR_COLS[Math.floor(Math.random()*STAR_COLS.length)],
        };
      });

      galaxyLayer = buildMilkyWay(w, h);
    };

    // ── Shooting star ─────────────────────────────────────────────────────────

    const spawnShooter = () => {
      const w = canvas.width, h = canvas.height;
      // Start anywhere along top or left edge, travel diagonally
      const fromTop = Math.random() < 0.7;
      shooter = {
        x:       fromTop ? Math.random() * w : 0,
        y:       fromTop ? Math.random() * h * 0.4 : Math.random() * h * 0.5,
        vx:      (3.5 + Math.random() * 4) * (Math.random() < 0.5 ? 1 : -1),
        vy:      1.5 + Math.random() * 2.5,
        len:     120 + Math.random() * 160,
        life:    0,
        maxLife: 55 + Math.random() * 30,
        active:  true,
      };
    };

    const drawShooter = () => {
      if (!shooter.active) return;
      const t   = shooter.life / shooter.maxLife;
      const op  = t < 0.2 ? t / 0.2 : t > 0.7 ? 1 - (t - 0.7) / 0.3 : 1;

      const tailX = shooter.x - shooter.vx * (shooter.len / Math.hypot(shooter.vx, shooter.vy));
      const tailY = shooter.y - shooter.vy * (shooter.len / Math.hypot(shooter.vx, shooter.vy));

      const grad = ctx.createLinearGradient(tailX, tailY, shooter.x, shooter.y);
      grad.addColorStop(0,   "rgba(255,255,255,0)");
      grad.addColorStop(0.6, `rgba(200,220,255,${op * 0.4})`);
      grad.addColorStop(1,   `rgba(255,255,255,${op})`);

      ctx.beginPath();
      ctx.moveTo(tailX, tailY);
      ctx.lineTo(shooter.x, shooter.y);
      ctx.strokeStyle = grad;
      ctx.lineWidth   = 1.5;
      ctx.globalAlpha = 1;
      ctx.stroke();

      // Bright head glow
      const glow = ctx.createRadialGradient(shooter.x, shooter.y, 0, shooter.x, shooter.y, 6);
      glow.addColorStop(0,   `rgba(255,255,255,${op * 0.9})`);
      glow.addColorStop(0.4, `rgba(180,210,255,${op * 0.4})`);
      glow.addColorStop(1,   "rgba(0,0,0,0)");
      ctx.beginPath();
      ctx.arc(shooter.x, shooter.y, 6, 0, Math.PI*2);
      ctx.fillStyle = glow;
      ctx.fill();

      shooter.x    += shooter.vx;
      shooter.y    += shooter.vy;
      shooter.life += 1;
      if (shooter.life >= shooter.maxLife) shooter.active = false;
    };

    // ── Render loop ───────────────────────────────────────────────────────────

    const tick = (time: number) => {
      ctx.clearRect(0, 0, canvas.width, canvas.height);

      // 1 — Static Milky Way band
      if (galaxyLayer) ctx.drawImage(galaxyLayer, 0, 0);

      // 2 — Stars (very subtle twinkle)
      stars.forEach(s => {
        const tw = Math.sin(time * s.speed + s.phase);
        const op = s.op * (0.84 + 0.16 * tw);
        ctx.globalAlpha = op;
        ctx.fillStyle   = s.color;
        ctx.beginPath();
        ctx.arc(s.x, s.y, s.r, 0, Math.PI*2);
        ctx.fill();

        // Tiny diffraction cross on brighter stars only
        if (s.r > 1.0) {
          ctx.globalAlpha = op * 0.20;
          ctx.strokeStyle = s.color;
          ctx.lineWidth   = 0.35;
          const arm = s.r * 5;
          ctx.beginPath();
          ctx.moveTo(s.x-arm, s.y); ctx.lineTo(s.x+arm, s.y);
          ctx.moveTo(s.x, s.y-arm); ctx.lineTo(s.x, s.y+arm);
          ctx.stroke();
        }
      });

      // 3 — Shooting star
      ctx.globalAlpha = 1;
      if (shooter.active) {
        drawShooter();
      } else if (time >= nextShot) {
        spawnShooter();
        nextShot = time + 8000 + Math.random() * 14000; // 8–22 s between shots
      }

      ctx.globalAlpha = 1;
      raf = requestAnimationFrame(tick);
    };

    const ro = new ResizeObserver(() => {
      init();
    });
    ro.observe(canvas);
    init();
    // Schedule first shooting star 3–7s in
    nextShot = performance.now() + 3000 + Math.random() * 4000;
    raf = requestAnimationFrame(tick);

    return () => { cancelAnimationFrame(raf); ro.disconnect(); };
  }, []);

  return <canvas ref={ref} className="absolute inset-0 h-full w-full block" />;
};

export const Hero = () => {
  return (
    <section className="relative w-full min-h-screen overflow-hidden" style={{ background: "#02030e" }}>
      <GalaxyCanvas />

      {/* Edge vignette */}
      <div
        className="pointer-events-none absolute inset-0"
        style={{ background: "radial-gradient(ellipse 120% 100% at 50% 50%, transparent 35%, rgba(1,2,10,0.70) 100%)" }}
      />

      {/* Content */}
      <div className="relative z-10 flex min-h-screen flex-col items-center justify-center px-6 pt-24 pb-16 text-center text-white">
        <h1 className="max-w-4xl text-4xl font-bold tracking-tight drop-shadow-lg md:text-5xl lg:text-6xl xl:text-7xl">
          Zelfbewustzijn, eigenheid en vrijheid
        </h1>
        <p className="mt-6 max-w-2xl text-lg text-white/75 drop-shadow md:text-xl">
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
            className="rounded-xl border-white/25 bg-white/8 px-8 text-white backdrop-blur-sm hover:bg-white/15"
            asChild
          >
            <a href="/about">Over Petra <ArrowRight className="ml-1 size-4" /></a>
          </Button>
        </div>
      </div>
    </section>
  );
};
