import { ArrowRight } from "lucide-react";
import { Button } from "@/components/ui/button";

export const Hero = () => {
  return (
    <section className="relative w-full min-h-screen overflow-hidden bg-gradient-to-b from-[#1a1240] via-[#2e1f6b] to-[#1a1240]">

      {/* Content — centered, padded to sit below nav */}
      <div className="relative z-10 flex min-h-screen flex-col items-center justify-center px-6 pt-24 pb-16 text-center text-white">
        <h1 className="max-w-4xl text-4xl font-bold tracking-tight drop-shadow-lg md:text-5xl lg:text-6xl xl:text-7xl">
          Zelfbewustzijn, eigenheid en vrijheid
        </h1>
        <p className="mt-6 max-w-2xl text-lg text-white/85 drop-shadow md:text-xl">
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
            className="rounded-xl border-white/40 bg-white/10 px-8 text-white backdrop-blur-sm hover:bg-white/20"
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
