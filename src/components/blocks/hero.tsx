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
    let offset = 0;           // current pan offset in px
    const PAN_SPEED = 0.18;   // px per frame — slow drift
    const TILE_W_MULT = 3;    // offscreen canvas is 3× viewport width for seamless loop

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

    let stars: Star[]    = [];
    let shooter: Shooter = { x:0,y:0,vx:0,vy:0,len:0,life:0,maxLife:0,active:false };
    let nextShot         = 0;
    let galaxyTile: HTMLCanvasElement | null = null;

    // ── Paint the galaxy tile ─────────────────────────────────────────────────

    const paintTile = (tw: number, th: number): HTMLCanvasElement => {
      const off = document.createElement("canvas");
      off.width = tw; off.height = th;
      const c   = off.getContext("2d")!;

      // Helper: radial blob
      const blob = (x:number, y:number, r:number, col:[number,number,number], alpha:number) => {
        const g = c.createRadialGradient(x,y,0,x,y,r);
        g.addColorStop(0,   `rgba(${col[0]},${col[1]},${col[2]},${alpha})`);
        g.addColorStop(0.45,`rgba(${col[0]},${col[1]},${col[2]},${alpha*0.45})`);
        g.addColorStop(1,   "rgba(0,0,0,0)");
        c.beginPath(); c.arc(x,y,r,0,Math.PI*2);
        c.fillStyle=g; c.fill();
      };

      // Deep navy base is CSS background-color — canvas is transparent

      // ── Large background nebula masses (deep blue) ───────────────────────
      const positions = [
        [0.10, 0.45], [0.28, 0.30], [0.42, 0.60], [0.55, 0.35],
        [0.68, 0.55], [0.80, 0.25], [0.92, 0.50], [1.05, 0.40],
        [1.18, 0.65], [1.30, 0.30], [1.45, 0.50], [1.60, 0.45],
        [1.75, 0.30], [1.90, 0.60], [2.05, 0.40], [2.20, 0.55],
        [2.38, 0.35], [2.55, 0.55], [2.72, 0.40], [2.88, 0.60],
      ];
      positions.forEach(([fx, fy]) => {
        blob(fx*tw, fy*th, th*(0.35+Math.abs(Math.sin(fx*7))*0.2), [18,60,160], 0.55);
        blob(fx*tw, fy*th, th*(0.18+Math.abs(Math.cos(fx*5))*0.1), [30,80,200], 0.45);
      });

      // ── Bright mid-blue clouds ────────────────────────────────────────────
      const mids = [
        [0.15,0.55],[0.32,0.40],[0.50,0.50],[0.65,0.30],[0.78,0.60],
        [0.95,0.45],[1.10,0.35],[1.25,0.55],[1.40,0.42],[1.58,0.60],
        [1.72,0.40],[1.88,0.30],[2.02,0.55],[2.18,0.45],[2.35,0.60],
        [2.50,0.35],[2.65,0.50],[2.82,0.40],[2.95,0.58],
      ];
      mids.forEach(([fx,fy]) => {
        blob(fx*tw, fy*th, th*(0.14+Math.abs(Math.sin(fx*9))*0.08), [50,110,220], 0.40);
      });

      // ── Lighter core patches (near-white blue) ────────────────────────────
      const bright = [
        [0.20,0.48],[0.45,0.38],[0.60,0.58],[0.85,0.42],
        [1.00,0.52],[1.20,0.38],[1.50,0.55],[1.68,0.35],
        [1.85,0.50],[2.10,0.42],[2.30,0.55],[2.60,0.38],
        [2.80,0.52],[2.95,0.45],
      ];
      bright.forEach(([fx,fy]) => {
        blob(fx*tw, fy*th, th*(0.06+Math.abs(Math.cos(fx*11))*0.04), [130,190,255], 0.35);
        blob(fx*tw, fy*th, th*0.025, [220,235,255], 0.40);
      });

      // ── Teal-green accents (like the image) ───────────────────────────────
      const teals = [[0.35,0.25],[0.70,0.65],[1.15,0.25],[1.55,0.65],[2.0,0.30],[2.50,0.65]];
      teals.forEach(([fx,fy]) => {
        blob(fx*tw, fy*th, th*0.09, [20,140,140], 0.20);
        blob(fx*tw, fy*th, th*0.04, [80,200,200], 0.18);
      });

      // ── White core sparkle regions ────────────────────────────────────────
      const whites = [[0.22,0.45],[0.62,0.52],[1.08,0.42],[1.52,0.50],[2.05,0.48],[2.55,0.44]];
      whites.forEach(([fx,fy]) => {
        blob(fx*tw, fy*th, th*0.05, [240,245,255], 0.22);
      });

      // ── Dense star field across the entire tile ───────────────────────────
      const COLS = [
        "#ffffff","#ffffff","#ffffff","#ddeeff","#cce0ff","#aad4ff","#fff8e8",
      ];
      const starCount = Math.floor((tw * th) / 500);
      for (let i = 0; i < starCount; i++) {
        const x     = Math.random() * tw;
        const y     = Math.random() * th;
        const big   = Math.random() < 0.03;
        const r     = big ? Math.random()*1.5+0.8 : Math.random()*0.5+0.08;
        const alpha = big ? Math.random()*0.6+0.4  : Math.random()*0.45+0.15;
        c.globalAlpha = alpha;
        c.fillStyle   = COLS[Math.floor(Math.random()*COLS.length)];
        c.beginPath(); c.arc(x,y,r,0,Math.PI*2); c.fill();

        // Cross on bright stars
        if (big && r > 1.2) {
          c.globalAlpha = alpha * 0.25;
          c.strokeStyle = "#ffffff";
          c.lineWidth   = 0.4;
          c.beginPath();
          c.moveTo(x-r*5,y); c.lineTo(x+r*5,y);
          c.moveTo(x,y-r*5); c.lineTo(x,y+r*5);
          c.stroke();
        }
      }
      c.globalAlpha = 1;

      return off;
    };

    // ── Shooting star ─────────────────────────────────────────────────────────

    const spawnShooter = () => {
      const w = canvas.width, h = canvas.height;
      shooter = {
        x: Math.random() * w * 0.6,
        y: Math.random() * h * 0.5,
        vx: 4 + Math.random() * 5,
        vy: 0.5 + Math.random() * 2,
        len: 130 + Math.random() * 120,
        life: 0,
        maxLife: 50 + Math.random() * 30,
        active: true,
      };
    };

    const drawShooter = () => {
      if (!shooter.active) return;
      const t  = shooter.life / shooter.maxLife;
      const op = t < 0.15 ? t/0.15 : t > 0.65 ? 1-(t-0.65)/0.35 : 1;
      const dist = Math.hypot(shooter.vx, shooter.vy);
      const tx = shooter.x - (shooter.vx/dist) * shooter.len;
      const ty = shooter.y - (shooter.vy/dist) * shooter.len;

      const g = ctx.createLinearGradient(tx,ty,shooter.x,shooter.y);
      g.addColorStop(0,   "rgba(255,255,255,0)");
      g.addColorStop(0.5, `rgba(180,210,255,${op*0.35})`);
      g.addColorStop(1,   `rgba(255,255,255,${op})`);
      ctx.beginPath(); ctx.moveTo(tx,ty); ctx.lineTo(shooter.x,shooter.y);
      ctx.strokeStyle=g; ctx.lineWidth=1.6; ctx.globalAlpha=1; ctx.stroke();

      const glow = ctx.createRadialGradient(shooter.x,shooter.y,0,shooter.x,shooter.y,7);
      glow.addColorStop(0,  `rgba(255,255,255,${op})`);
      glow.addColorStop(0.3,`rgba(160,200,255,${op*0.5})`);
      glow.addColorStop(1,  "rgba(0,0,0,0)");
      ctx.beginPath(); ctx.arc(shooter.x,shooter.y,7,0,Math.PI*2);
      ctx.fillStyle=glow; ctx.fill();

      shooter.x    += shooter.vx;
      shooter.y    += shooter.vy;
      shooter.life += 1;
      if (shooter.life >= shooter.maxLife) shooter.active = false;
    };

    // ── Init ──────────────────────────────────────────────────────────────────

    const init = () => {
      canvas.width  = canvas.offsetWidth;
      canvas.height = canvas.offsetHeight;
      const tw = canvas.width * TILE_W_MULT;
      galaxyTile = paintTile(tw, canvas.height);
      offset = 0;
    };

    // ── Render loop ───────────────────────────────────────────────────────────

    const tick = (time: number) => {
      const w = canvas.width, h = canvas.height;
      ctx.clearRect(0, 0, w, h);

      // Scroll galaxy tile — loop seamlessly
      if (galaxyTile) {
        const tileW = galaxyTile.width;
        // offset increases → apparent motion to the left (stars drift left = camera pans right)
        const x = -(offset % tileW);
        ctx.drawImage(galaxyTile, x,       0, tileW, h);
        ctx.drawImage(galaxyTile, x+tileW, 0, tileW, h); // second copy for seamless wrap
        offset += PAN_SPEED;
      }

      // Shooting star
      ctx.globalAlpha = 1;
      if (shooter.active) {
        drawShooter();
      } else if (time >= nextShot) {
        spawnShooter();
        nextShot = time + 9000 + Math.random() * 13000;
      }

      ctx.globalAlpha = 1;
      raf = requestAnimationFrame(tick);
    };

    const ro = new ResizeObserver(init);
    ro.observe(canvas);
    init();
    nextShot = performance.now() + 4000 + Math.random() * 5000;
    raf = requestAnimationFrame(tick);

    return () => { cancelAnimationFrame(raf); ro.disconnect(); };
  }, []);

  return <canvas ref={ref} className="absolute inset-0 h-full w-full block" />;
};

export const Hero = () => {
  return (
    <section
      className="relative w-full min-h-screen overflow-hidden"
      style={{ background: "#02040f" }}
    >
      <GalaxyCanvas />

      {/* Vignette */}
      <div
        className="pointer-events-none absolute inset-0"
        style={{ background: "radial-gradient(ellipse 130% 100% at 50% 50%, transparent 30%, rgba(1,2,12,0.60) 100%)" }}
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
