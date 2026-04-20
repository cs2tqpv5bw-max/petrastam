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

    interface Star {
      x: number; y: number; r: number;
      opacity: number; twinkleSpeed: number; phase: number;
      color: string;
    }

    interface Symbol {
      x: number; y: number; size: number;
      rotation: number; rotSpeed: number;
      opacity: number; target: number; fadeSpeed: number;
      type: "triangle" | "hexagon" | "ring" | "diamond";
    }

    let stars: Star[]   = [];
    let symbols: Symbol[] = [];

    // Real galaxy star colors — mostly blue-white, some warm
    const STAR_COLORS = [
      "#ffffff", "#ffffff", "#ffffff",   // majority pure white
      "#ddeeff", "#cce0ff",              // blue-white (hot stars)
      "#fff8e8", "#ffeedd",              // warm/yellow (sun-like)
      "#aaccff",                          // blue (young stars)
    ];

    const init = () => {
      canvas.width  = canvas.offsetWidth;
      canvas.height = canvas.offsetHeight;

      // Dense but tiny star field — real galaxy has thousands
      const count = Math.floor((canvas.width * canvas.height) / 800);
      stars = Array.from({ length: count }, () => {
        const isBright = Math.random() < 0.04; // 4% slightly brighter
        return {
          x:            Math.random() * canvas.width,
          y:            Math.random() * canvas.height,
          r:            isBright ? Math.random() * 1.2 + 0.6 : Math.random() * 0.6 + 0.1,
          opacity:      isBright ? Math.random() * 0.5 + 0.4  : Math.random() * 0.35 + 0.1,
          twinkleSpeed: Math.random() * 0.006 + 0.001, // very slow
          phase:        Math.random() * Math.PI * 2,
          color:        STAR_COLORS[Math.floor(Math.random() * STAR_COLORS.length)],
        };
      });

      // Sparse light language — very faint, slow
      symbols = Array.from({ length: 8 }, () => ({
        x:         Math.random() * canvas.width,
        y:         Math.random() * canvas.height,
        size:      Math.random() * 35 + 15,
        rotation:  Math.random() * Math.PI * 2,
        rotSpeed:  (Math.random() - 0.5) * 0.0008,
        opacity:   0,
        target:    Math.random() * 0.055,
        fadeSpeed: Math.random() * 0.001 + 0.0003,
        type:      (["triangle","hexagon","ring","diamond"] as const)[
                     Math.floor(Math.random() * 4)
                   ],
      }));
    };

    // ── Galaxy cloud layers (painted once into offscreen, reused each frame)
    const paintGalaxy = (w: number, h: number): HTMLCanvasElement => {
      const off = document.createElement("canvas");
      off.width  = w;
      off.height = h;
      const c = off.getContext("2d")!;

      // Central core — warm golden nucleus
      const cx = w * 0.5, cy = h * 0.48;
      const coreR = Math.min(w, h) * 0.12;
      const core = c.createRadialGradient(cx, cy, 0, cx, cy, coreR);
      core.addColorStop(0,    "rgba(255,230,160,0.55)");
      core.addColorStop(0.15, "rgba(220,180,100,0.30)");
      core.addColorStop(0.4,  "rgba(150,110,200,0.15)");
      core.addColorStop(1,    "rgba(0,0,0,0)");
      c.beginPath();
      c.arc(cx, cy, coreR, 0, Math.PI * 2);
      c.fillStyle = core;
      c.fill();

      // Galaxy disc — wide, tilted ellipse, blue-purple
      const disc = (
        ax: number, ay: number, rx: number, ry: number,
        angle: number, color0: string, color1: string
      ) => {
        c.save();
        c.translate(ax, ay);
        c.rotate(angle);
        c.scale(1, ry / rx);
        const g = c.createRadialGradient(0, 0, 0, 0, 0, rx);
        g.addColorStop(0,    color0);
        g.addColorStop(0.45, color1);
        g.addColorStop(1,    "rgba(0,0,0,0)");
        c.beginPath();
        c.arc(0, 0, rx, 0, Math.PI * 2);
        c.fillStyle = g;
        c.fill();
        c.restore();
      };

      // Main disc
      disc(cx, cy,
        Math.min(w,h)*0.55, Math.min(w,h)*0.22,
        0.35,
        "rgba(80,60,160,0.18)", "rgba(30,20,80,0.08)"
      );
      // Secondary arm offset
      disc(cx + w*0.06, cy - h*0.04,
        Math.min(w,h)*0.38, Math.min(w,h)*0.13,
        -0.5,
        "rgba(60,90,180,0.13)", "rgba(10,20,70,0.05)"
      );

      // Nebula dust clouds — several soft blobs
      const blob = (
        bx: number, by: number, br: number,
        r: number, g: number, b: number, a: number
      ) => {
        const grad = c.createRadialGradient(bx, by, 0, bx, by, br);
        grad.addColorStop(0,   `rgba(${r},${g},${b},${a})`);
        grad.addColorStop(0.5, `rgba(${r},${g},${b},${a*0.4})`);
        grad.addColorStop(1,   "rgba(0,0,0,0)");
        c.beginPath();
        c.arc(bx, by, br, 0, Math.PI * 2);
        c.fillStyle = grad;
        c.fill();
      };

      blob(cx*0.6,  cy*0.7,  Math.min(w,h)*0.28,  30, 50,130, 0.12);  // blue left
      blob(cx*1.4,  cy*1.2,  Math.min(w,h)*0.22,  60, 30,120, 0.10);  // purple right
      blob(cx*0.85, cy*1.35, Math.min(w,h)*0.18,  20, 40,100, 0.08);  // deep blue low
      blob(cx*1.15, cy*0.65, Math.min(w,h)*0.16,  80, 50,150, 0.09);  // violet high
      blob(cx,      cy,      Math.min(w,h)*0.08,  200,160, 80, 0.20); // warm inner halo

      return off;
    };

    let galaxyLayer: HTMLCanvasElement | null = null;

    const drawSymbol = (s: Symbol) => {
      if (s.opacity < 0.001) return;
      ctx.save();
      ctx.translate(s.x, s.y);
      ctx.rotate(s.rotation);
      ctx.strokeStyle = `rgba(180,160,255,${s.opacity})`;
      ctx.lineWidth   = 0.6;
      ctx.globalAlpha = 1;

      const p = (sides: number, r: number) => {
        ctx.beginPath();
        for (let i = 0; i < sides; i++) {
          const a = (i / sides) * Math.PI * 2 - Math.PI / 2;
          i === 0 ? ctx.moveTo(Math.cos(a)*r, Math.sin(a)*r)
                  : ctx.lineTo(Math.cos(a)*r, Math.sin(a)*r);
        }
        ctx.closePath();
        ctx.stroke();
      };

      if (s.type === "triangle") { p(3, s.size); ctx.rotate(Math.PI); p(3, s.size*0.55); }
      if (s.type === "hexagon")  { p(6, s.size); p(6, s.size*0.5); }
      if (s.type === "ring") {
        ctx.beginPath(); ctx.arc(0,0,s.size,0,Math.PI*2); ctx.stroke();
        ctx.beginPath(); ctx.arc(0,0,s.size*0.55,0,Math.PI*2); ctx.stroke();
      }
      if (s.type === "diamond") {
        ctx.beginPath();
        ctx.moveTo(0,-s.size); ctx.lineTo(s.size*0.5,0);
        ctx.lineTo(0,s.size);  ctx.lineTo(-s.size*0.5,0);
        ctx.closePath(); ctx.stroke();
      }
      ctx.restore();
    };

    const tick = (time: number) => {
      ctx.clearRect(0, 0, canvas.width, canvas.height);

      // Galaxy cloud (static offscreen layer)
      if (galaxyLayer) ctx.drawImage(galaxyLayer, 0, 0);

      // Stars — minimal twinkle
      stars.forEach(s => {
        const tw  = Math.sin(time * s.twinkleSpeed + s.phase);
        const op  = s.opacity * (0.82 + 0.18 * tw); // tiny variation
        ctx.globalAlpha = op;
        ctx.beginPath();
        ctx.arc(s.x, s.y, s.r, 0, Math.PI * 2);
        ctx.fillStyle = s.color;
        ctx.fill();

        // Subtle cross spike only on brightest stars
        if (s.r > 1.1) {
          ctx.globalAlpha = op * 0.25;
          ctx.strokeStyle = s.color;
          ctx.lineWidth   = 0.4;
          ctx.beginPath();
          ctx.moveTo(s.x - s.r*4, s.y); ctx.lineTo(s.x + s.r*4, s.y);
          ctx.moveTo(s.x, s.y - s.r*4); ctx.lineTo(s.x, s.y + s.r*4);
          ctx.stroke();
        }
      });

      // Light language — barely visible
      symbols.forEach(s => {
        const diff = s.target - s.opacity;
        if (Math.abs(diff) < s.fadeSpeed) {
          s.target = Math.random() < 0.4 ? Math.random() * 0.055 : 0;
        } else {
          s.opacity += diff > 0 ? s.fadeSpeed : -s.fadeSpeed;
        }
        s.rotation += s.rotSpeed;
        drawSymbol(s);
      });

      ctx.globalAlpha = 1;
      raf = requestAnimationFrame(tick);
    };

    const ro = new ResizeObserver(() => {
      init();
      galaxyLayer = paintGalaxy(canvas.width, canvas.height);
    });
    ro.observe(canvas);
    init();
    galaxyLayer = paintGalaxy(canvas.width, canvas.height);
    raf = requestAnimationFrame(tick);

    return () => { cancelAnimationFrame(raf); ro.disconnect(); };
  }, []);

  return <canvas ref={ref} className="absolute inset-0 h-full w-full block" />;
};

export const Hero = () => {
  return (
    <section className="relative w-full min-h-screen overflow-hidden" style={{ background: "#03050f" }}>
      <GalaxyCanvas />

      {/* Soft vignette */}
      <div className="pointer-events-none absolute inset-0"
        style={{ background: "radial-gradient(ellipse at center, transparent 40%, rgba(2,3,12,0.65) 100%)" }}
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
          <Button size="lg"
            className="rounded-xl bg-primary px-8 text-primary-foreground shadow-lg hover:bg-primary/90"
            asChild
          >
            <a href="/shop">Webshop</a>
          </Button>
          <Button size="lg" variant="outline"
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
