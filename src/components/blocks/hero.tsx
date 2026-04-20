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
    let offset   = 0;
    const SPEED  = 0.18;        // px/frame — slow drift rightward
    const TILE_W = 3;           // tile is 3× canvas width
    const FADE_W = 280;         // px over which blobs fade in from left edge

    // ── Types ─────────────────────────────────────────────────────────────────

    interface Blob {
      fx: number;          // fractional x in tile (0–TILE_W)
      fy: number;          // fractional y (0–1)
      fr: number;          // fractional radius (relative to tile height)
      col: [number,number,number];
      baseAlpha: number;
      phase: number;       // sine phase for opacity flicker
      speed: number;       // how fast it oscillates
      dim: 0.10 | 0.15;   // how much it can drop below baseline (never above)
      isAnchor: boolean;   // true for major blobs that own a star cluster
    }

    interface StarCluster {
      blobIdx: number;
      stars: Array<{ dx: number; dy: number; r: number; baseOp: number; col: string }>;
    }

    interface Star {
      x: number; y: number; r: number;
      op: number; twSpeed: number; phase: number; color: string;
    }

    interface Shooter {
      x: number; y: number; vx: number; vy: number;
      len: number; life: number; maxLife: number; active: boolean;
    }

    // ── Blob definitions ──────────────────────────────────────────────────────

    const makeBlobs = (): Blob[] => {
      const list: Blob[] = [];
      const push = (fx:number, fy:number, fr:number, col:[number,number,number], a:number, anchor = false) => {
        list.push({ fx, fy, fr, col, baseAlpha: a,
          phase:    Math.random() * Math.PI * 2,
          speed:    0.0004 + Math.random() * 0.0006,
          dim:      Math.random() < 0.5 ? 0.10 : 0.15,   // randomly either −10% or −15%
          isAnchor: anchor,
        });
      };

      // Deep blue background masses (isAnchor=true → owns a star cluster)
      [[0.10,0.45],[0.28,0.30],[0.42,0.60],[0.55,0.35],[0.68,0.55],
       [0.80,0.25],[0.92,0.50],[1.05,0.40],[1.18,0.65],[1.30,0.30],
       [1.45,0.50],[1.60,0.45],[1.75,0.30],[1.90,0.60],[2.05,0.40],
       [2.20,0.55],[2.38,0.35],[2.55,0.55],[2.72,0.40],[2.88,0.60],
      ].forEach(([fx,fy]) => {
        push(fx,fy, 0.35+Math.abs(Math.sin(fx*7))*0.18, [18,60,160],  0.52, true);
        push(fx,fy, 0.18+Math.abs(Math.cos(fx*5))*0.10, [30,80,200],  0.42);
      });

      // Bright mid-blue clouds
      [[0.15,0.55],[0.32,0.40],[0.50,0.50],[0.65,0.30],[0.78,0.60],
       [0.95,0.45],[1.10,0.35],[1.25,0.55],[1.40,0.42],[1.58,0.60],
       [1.72,0.40],[1.88,0.30],[2.02,0.55],[2.18,0.45],[2.35,0.60],
       [2.50,0.35],[2.65,0.50],[2.82,0.40],[2.95,0.58],
      ].forEach(([fx,fy]) => {
        push(fx,fy, 0.14+Math.abs(Math.sin(fx*9))*0.08, [50,110,220], 0.38);
      });

      // Near-white bright patches
      [[0.20,0.48],[0.45,0.38],[0.60,0.58],[0.85,0.42],
       [1.00,0.52],[1.20,0.38],[1.50,0.55],[1.68,0.35],
       [1.85,0.50],[2.10,0.42],[2.30,0.55],[2.60,0.38],
       [2.80,0.52],[2.95,0.45],
      ].forEach(([fx,fy]) => {
        push(fx,fy, 0.06+Math.abs(Math.cos(fx*11))*0.04, [130,190,255], 0.33);
        push(fx,fy, 0.025, [220,235,255], 0.38);
      });

      // Purple nebula clouds (isAnchor=true → owns a star cluster)
      [[0.08,0.60],[0.25,0.35],[0.48,0.70],[0.72,0.25],[0.90,0.65],
       [1.05,0.30],[1.28,0.65],[1.48,0.28],[1.65,0.68],[1.82,0.35],
       [2.00,0.65],[2.22,0.30],[2.45,0.68],[2.68,0.38],[2.90,0.55],
      ].forEach(([fx,fy]) => {
        push(fx,fy, 0.20+Math.abs(Math.sin(fx*6))*0.12, [90,30,160],  0.36, true);
        push(fx,fy, 0.10+Math.abs(Math.cos(fx*8))*0.06, [130,50,200], 0.28);
      });

      // Deep violet patches
      [[0.18,0.50],[0.55,0.30],[0.85,0.65],[1.15,0.48],[1.42,0.55],
       [1.70,0.25],[2.00,0.55],[2.35,0.42],[2.70,0.60],[2.95,0.35],
      ].forEach(([fx,fy]) => {
        push(fx,fy, 0.12+Math.abs(Math.sin(fx*10))*0.07, [70,20,130],   0.33);
        push(fx,fy, 0.05, [180,100,255], 0.18);
      });

      // Pink-purple emission zones
      [[0.30,0.55],[0.60,0.35],[1.00,0.60],[1.35,0.38],
       [1.75,0.55],[2.10,0.35],[2.55,0.58],[2.85,0.40],
      ].forEach(([fx,fy]) => {
        push(fx,fy, 0.07, [160,60,180],  0.20);
        push(fx,fy, 0.03, [210,120,255], 0.18);
      });

      // Teal accents
      [[0.35,0.25],[0.70,0.65],[1.15,0.25],[1.55,0.65],[2.0,0.30],[2.50,0.65],
      ].forEach(([fx,fy]) => {
        push(fx,fy, 0.09, [20,140,140],  0.17);
        push(fx,fy, 0.04, [80,200,200],  0.14);
      });

      // White sparkle cores
      [[0.22,0.45],[0.62,0.52],[1.08,0.42],[1.52,0.50],[2.05,0.48],[2.55,0.44],
      ].forEach(([fx,fy]) => {
        push(fx,fy, 0.05, [240,235,255], 0.20);
      });

      return list;
    };

    // ── Star tile (static, stars only) ────────────────────────────────────────

    const buildStarTile = (tw: number, th: number): HTMLCanvasElement => {
      const off = document.createElement("canvas");
      off.width = tw; off.height = th;
      const c   = off.getContext("2d")!;
      const COLS = ["#ffffff","#ffffff","#ffffff","#ddeeff","#cce0ff","#aad4ff","#fff8e8"];
      const n    = Math.floor((tw * th) / 500);

      for (let i = 0; i < n; i++) {
        const x   = Math.random() * tw;
        const y   = Math.random() * th;
        const big = Math.random() < 0.03;
        const r   = big ? Math.random()*1.5+0.8 : Math.random()*0.5+0.08;
        const a   = big ? Math.random()*0.6+0.4  : Math.random()*0.45+0.15;
        c.globalAlpha = a;
        c.fillStyle   = COLS[Math.floor(Math.random()*COLS.length)];
        c.beginPath(); c.arc(x,y,r,0,Math.PI*2); c.fill();
        if (big && r > 1.2) {
          c.globalAlpha = a * 0.22;
          c.strokeStyle = "#ffffff"; c.lineWidth = 0.35;
          c.beginPath();
          c.moveTo(x-r*5,y); c.lineTo(x+r*5,y);
          c.moveTo(x,y-r*5); c.lineTo(x,y+r*5);
          c.stroke();
        }
      }
      c.globalAlpha = 1;
      return off;
    };

    // ── Draw a single blob dynamically ────────────────────────────────────────

    const drawBlob = (b: Blob, tw: number, th: number, drawX: number, time: number) => {
      // World position → screen position
      const wx = b.fx * (tw / TILE_W);       // blob's x in tile pixels
      const wy = b.fy * th;
      const sx = wx + drawX;                  // screen x (first copy)
      const r  = b.fr * th;

      // Skip if entirely off screen (both copies)
      const copy2X = sx + tw / TILE_W * TILE_W; // not needed, handled by drawing twice

      const draw = (screenX: number) => {
        if (screenX + r < 0 || screenX - r > canvas.width) return;

        // Opacity: baseline max, drops by dim (10% or 15%) — never exceeds baseAlpha
        // factor oscillates between (1 − dim) and 1.0
        const osc  = 1.0 - b.dim * (0.5 + 0.5 * Math.sin(time * b.speed + b.phase));

        // Left-edge fade-in: blob fades in over FADE_W px as it enters from left
        const edgeDist = screenX + r;             // dist of right edge from screen left
        const fadeIn   = Math.min(1, edgeDist / FADE_W);

        const alpha = b.baseAlpha * osc * fadeIn;
        if (alpha < 0.005) return;

        const g = ctx.createRadialGradient(screenX,wy,0, screenX,wy,r);
        g.addColorStop(0,    `rgba(${b.col[0]},${b.col[1]},${b.col[2]},${alpha})`);
        g.addColorStop(0.45, `rgba(${b.col[0]},${b.col[1]},${b.col[2]},${alpha*0.45})`);
        g.addColorStop(1,    "rgba(0,0,0,0)");
        ctx.beginPath();
        ctx.arc(screenX, wy, r, 0, Math.PI*2);
        ctx.fillStyle = g;
        ctx.globalAlpha = 1;
        ctx.fill();
      };

      // Draw two copies for seamless tile wrap
      draw(sx);
      draw(sx + tw);          // second copy offset by full tile width
    };

    // ── Star clusters (dynamic density tied to anchor blobs) ──────────────────

    const buildClusters = (blobs: Blob[], th: number): StarCluster[] => {
      const SCOLS = ["#ffffff","#ffffff","#ddeeff","#cce0ff","#eebbff","#bbddff","#fff8e8"];
      return blobs.reduce<StarCluster[]>((acc, b, i) => {
        if (!b.isAnchor) return acc;
        const r = b.fr * th;
        // More stars for larger blobs
        const count = Math.floor(30 + r * 0.5);
        const stars = Array.from({ length: count }, () => ({
          dx:     (Math.random() - 0.5) * r * 2.2,
          dy:     (Math.random() - 0.5) * r * 2.2,
          r:      Math.random() * 0.65 + 0.1,
          baseOp: Math.random() * 0.55 + 0.20,
          col:    SCOLS[Math.floor(Math.random() * SCOLS.length)],
        }));
        acc.push({ blobIdx: i, stars });
        return acc;
      }, []);
    };

    const drawClusters = (
      clusters: StarCluster[], blobs: Blob[],
      tw: number, th: number, drawX: number, time: number
    ) => {
      clusters.forEach(({ blobIdx, stars }) => {
        const b  = blobs[blobIdx];
        const wx = b.fx * (tw / TILE_W);
        const wy = b.fy * th;

        // Same opacity factor as the blob itself
        const osc    = 1.0 - b.dim * (0.5 + 0.5 * Math.sin(time * b.speed + b.phase));
        const blobOp = b.baseAlpha * osc;   // blob's current effective alpha

        // Normalise to 0–1 range for star multiplier (relative to baseAlpha)
        const factor = osc;   // 0.85–1.0 or 0.90–1.0

        const drawAt = (baseX: number) => {
          const cx = baseX + wx;
          if (cx + b.fr * th < 0 || cx - b.fr * th > canvas.width) return;
          const edgeFade = Math.min(1, (cx + b.fr * th) / FADE_W);

          stars.forEach(s => {
            const sx = cx + s.dx;
            const sy = wy + s.dy;
            if (sx < -2 || sx > canvas.width + 2) return;
            const alpha = s.baseOp * factor * edgeFade;
            ctx.globalAlpha = alpha;
            ctx.fillStyle   = s.col;
            ctx.beginPath();
            ctx.arc(sx, sy, s.r, 0, Math.PI * 2);
            ctx.fill();
          });
        };

        drawAt(drawX);
        drawAt(drawX + tw);
      });
      ctx.globalAlpha = 1;
    };

    // ── Shooting star ─────────────────────────────────────────────────────────

    let shooter: Shooter = { x:0,y:0,vx:0,vy:0,len:0,life:0,maxLife:0,active:false };
    let nextShot = 0;

    const spawnShooter = () => {
      shooter = {
        x: Math.random() * canvas.width * 0.5,
        y: Math.random() * canvas.height * 0.45,
        vx: 4 + Math.random() * 5,
        vy: 0.6 + Math.random() * 2,
        len: 130 + Math.random() * 120,
        life: 0, maxLife: 50 + Math.random() * 30, active: true,
      };
    };

    const drawShooter = () => {
      if (!shooter.active) return;
      const t  = shooter.life / shooter.maxLife;
      const op = t < 0.15 ? t/0.15 : t > 0.65 ? 1-(t-0.65)/0.35 : 1;
      const d  = Math.hypot(shooter.vx, shooter.vy);
      const tx = shooter.x - (shooter.vx/d)*shooter.len;
      const ty = shooter.y - (shooter.vy/d)*shooter.len;
      const g  = ctx.createLinearGradient(tx,ty,shooter.x,shooter.y);
      g.addColorStop(0,   "rgba(255,255,255,0)");
      g.addColorStop(0.5, `rgba(180,210,255,${op*0.35})`);
      g.addColorStop(1,   `rgba(255,255,255,${op})`);
      ctx.beginPath(); ctx.moveTo(tx,ty); ctx.lineTo(shooter.x,shooter.y);
      ctx.strokeStyle=g; ctx.lineWidth=1.6; ctx.globalAlpha=1; ctx.stroke();
      const gw = ctx.createRadialGradient(shooter.x,shooter.y,0,shooter.x,shooter.y,7);
      gw.addColorStop(0,  `rgba(255,255,255,${op})`);
      gw.addColorStop(0.4,`rgba(160,200,255,${op*0.5})`);
      gw.addColorStop(1,  "rgba(0,0,0,0)");
      ctx.beginPath(); ctx.arc(shooter.x,shooter.y,7,0,Math.PI*2);
      ctx.fillStyle=gw; ctx.fill();
      shooter.x+=shooter.vx; shooter.y+=shooter.vy; shooter.life++;
      if (shooter.life>=shooter.maxLife) shooter.active=false;
    };

    // ── Init ──────────────────────────────────────────────────────────────────

    let blobs:    Blob[]        = [];
    let clusters: StarCluster[] = [];
    let starTile: HTMLCanvasElement | null = null;

    const init = () => {
      canvas.width  = canvas.offsetWidth;
      canvas.height = canvas.offsetHeight;
      const tw = canvas.width * TILE_W;
      starTile = buildStarTile(tw, canvas.height);
      blobs    = makeBlobs();
      clusters = buildClusters(blobs, canvas.height);
      offset   = 0;
    };

    // ── Render loop ───────────────────────────────────────────────────────────

    const tick = (time: number) => {
      const w  = canvas.width, h = canvas.height;
      const tw = w * TILE_W;

      ctx.clearRect(0, 0, w, h);

      // Pan direction: tile drifts rightward → content enters from LEFT
      // drawX goes from -(tw-w) back to 0, cycling
      const drawX = -(offset % tw);

      // 1 — Nebula blobs (dynamic opacity + left-edge fade)
      blobs.forEach(b => drawBlob(b, tw, h, drawX, time));

      // 1b — Star clusters (density synced to anchor blobs)
      drawClusters(clusters, blobs, tw, h, drawX, time);

      // 2 — Stars (static tile, two copies for wrap)
      if (starTile) {
        ctx.globalAlpha = 1;
        ctx.drawImage(starTile, drawX,    0, tw, h);
        ctx.drawImage(starTile, drawX+tw, 0, tw, h);
      }

      // 3 — Shooting star
      ctx.globalAlpha = 1;
      if (shooter.active) {
        drawShooter();
      } else if (time >= nextShot) {
        spawnShooter();
        nextShot = time + 9000 + Math.random() * 13000;
      }

      ctx.globalAlpha = 1;
      offset += SPEED;
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
    <section className="relative w-full min-h-screen overflow-hidden" style={{ background: "#02040f" }}>
      <GalaxyCanvas />
      <div
        className="pointer-events-none absolute inset-0"
        style={{ background: "radial-gradient(ellipse 130% 100% at 50% 50%, transparent 30%, rgba(1,2,12,0.60) 100%)" }}
      />
      <div className="relative z-10 flex min-h-screen flex-col items-center justify-center px-6 pt-24 pb-16 text-center text-white">
        <h1 className="max-w-4xl text-4xl font-bold tracking-tight drop-shadow-lg md:text-5xl lg:text-6xl xl:text-7xl">
          Zelfbewustzijn, eigenheid en vrijheid
        </h1>
        <p className="mt-6 max-w-2xl text-lg text-white/75 drop-shadow md:text-xl">
          Boeken · Kaarten · Cursussen · Workshops · Consulten
        </p>
        <div className="mt-10 flex flex-wrap items-center justify-center gap-4">
          <Button size="lg" className="rounded-xl bg-primary px-8 text-primary-foreground shadow-lg hover:bg-primary/90" asChild>
            <a href="/shop">Webshop</a>
          </Button>
          <Button size="lg" variant="outline" className="rounded-xl border-white/25 bg-white/8 px-8 text-white backdrop-blur-sm hover:bg-white/15" asChild>
            <a href="/about">Over Petra <ArrowRight className="ml-1 size-4" /></a>
          </Button>
        </div>
      </div>
    </section>
  );
};
