"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { ChevronLeft, ChevronRight } from "lucide-react";
import type { HeroBanner } from "@/lib/queries/banners";
import { getImageProps } from "next/image";
import { canOptimize } from "@/lib/images";

export default function HeroSlider({ banners }: { banners: HeroBanner[] }) {
  const [index, setIndex] = useState(0);
  const [paused, setPaused] = useState(false);
  const n = banners.length;
  const go = useCallback((d: number) => setIndex((x) => (x + d + n) % n), [n]);

  useEffect(() => {
    if (n < 2 || paused) return;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    const t = setInterval(() => {
      if (!document.hidden) setIndex((x) => (x + 1) % n);
    }, 6000);
    return () => clearInterval(t);
  }, [n, paused]);

  return (
    <section
      className="relative overflow-hidden bg-navy text-white"
      aria-roledescription="carousel"
      aria-label="메인 배너"
      onMouseEnter={() => setPaused(true)}
      onMouseLeave={() => setPaused(false)}
      onFocus={() => setPaused(true)}
      onBlur={() => setPaused(false)}
    >
      <div className="relative min-h-[480px] md:min-h-[560px]">
        {banners.map((b, i) => {
          const active = i === index;
          const lines = b.title.split("|");
          const Heading = i === 0 ? "h1" : "h2";
          return (
            <div
              key={b.id}
              className={`absolute inset-0 transition-opacity duration-700 ${active ? "opacity-100" : "pointer-events-none opacity-0"}`}
              aria-hidden={!active}
              aria-roledescription="slide"
              aria-label={`${i + 1} / ${n}`}
            >
              {(() => {
                const mobileSrc = b.image_mobile ?? b.image_pc;
                const opt = canOptimize(b.image_pc) && canOptimize(mobileSrc);
                const pc = getImageProps({ alt: "", src: b.image_pc, width: 1920, height: 720, sizes: "100vw", unoptimized: !opt }).props;
                const { srcSet: mobileSet, ...img } = getImageProps({ alt: "", src: mobileSrc, width: 900, height: 1100, sizes: "100vw", unoptimized: !opt }).props;
                return (
                  <picture className="absolute inset-0">
                    <source media="(min-width: 768px)" srcSet={pc.srcSet ?? b.image_pc} sizes="100vw" />
                    <source media="(max-width: 767px)" srcSet={mobileSet ?? mobileSrc} sizes="100vw" />
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      {...img}
                      alt=""
                      className="h-full w-full object-cover"
                      loading={i === 0 ? "eager" : "lazy"}
                      fetchPriority={i === 0 ? "high" : "auto"}
                    />
                  </picture>
                );
              })()}
              <div className="absolute inset-0 bg-gradient-to-r from-navy/95 via-navy/75 to-navy/30 md:from-navy/90 md:via-navy/55 md:to-transparent" />

              <div className="relative mx-auto flex h-full max-w-site flex-col justify-center px-4 py-16 md:px-6">
                {b.eyebrow && <p className="text-sm font-semibold text-white/70">{b.eyebrow}</p>}
                <Heading className="mt-4 max-w-2xl text-[34px] font-extrabold leading-[1.2] tracking-[-0.03em] md:text-[56px]">
                  {lines.map((l, k) => (
                    <span key={k}>
                      {k > 0 && <br />}
                      {l.trim()}
                    </span>
                  ))}
                </Heading>
                {b.subtitle && <p className="mt-5 max-w-lg text-base text-white/80 md:text-lg">{b.subtitle}</p>}
                {b.link_url && b.button_label && (
                  <Link
                    href={b.link_url}
                    tabIndex={active ? 0 : -1}
                    className="mt-8 inline-flex w-fit rounded-lg bg-coral px-7 py-4 text-[15px] font-bold text-white transition-colors hover:bg-coral-600"
                  >
                    {b.button_label}
                  </Link>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {n > 1 && (
        <>
          <button
            type="button"
            aria-label="이전 배너"
            onClick={() => go(-1)}
            className="absolute left-4 top-1/2 hidden h-11 w-11 -translate-y-1/2 place-items-center rounded-full bg-black/25 text-white hover:bg-black/40 md:grid"
          >
            <ChevronLeft size={22} />
          </button>
          <button
            type="button"
            aria-label="다음 배너"
            onClick={() => go(1)}
            className="absolute right-4 top-1/2 hidden h-11 w-11 -translate-y-1/2 place-items-center rounded-full bg-black/25 text-white hover:bg-black/40 md:grid"
          >
            <ChevronRight size={22} />
          </button>
          <div className="absolute inset-x-0 bottom-5 flex justify-center gap-2">
            {banners.map((b, i) => (
              <button
                key={b.id}
                type="button"
                aria-label={`${i + 1}번 배너 보기`}
                aria-current={i === index}
                onClick={() => setIndex(i)}
                className={`h-2 rounded-full transition-all ${i === index ? "w-6 bg-white" : "w-2 bg-white/50 hover:bg-white/80"}`}
              />
            ))}
          </div>
        </>
      )}
    </section>
  );
}