"use client";

import { useState } from "react";
import Image from "next/image";
import { canOptimize } from "@/lib/images";

export default function PackageGallery({
  images,
  name,
  fallbackLabel,
}: {
  images: string[];
  name: string;
  fallbackLabel: string;
}) {
  const [idx, setIdx] = useState(0);

  if (images.length === 0) {
    return (
      <div className="flex aspect-square items-end rounded-xl bg-soft p-8">
        <span className="text-lg font-bold text-sub">{fallbackLabel}</span>
      </div>
    );
  }

  const main = images[idx];

  return (
    <div>
      <div className="relative aspect-square overflow-hidden rounded-xl bg-soft">
        <Image
          key={main}
          src={main}
          alt={name}
          fill
          sizes="(min-width: 1024px) 720px, 100vw"
          className="object-cover"
          loading={idx === 0 ? "eager" : "lazy"}
          fetchPriority={idx === 0 ? "high" : "auto"}
          unoptimized={!canOptimize(main)}
        />
      </div>
      {images.length > 1 && (
        <div className="mt-3 grid grid-cols-5 gap-2">
          {images.map((src, i) => (
            <button
              key={src}
              type="button"
              onClick={() => setIdx(i)}
              aria-label={`이미지 ${i + 1}`}
              className={`relative aspect-square overflow-hidden rounded-lg border-2 ${
                i === idx ? "border-navy" : "border-transparent"
              }`}
            >
              <Image src={src} alt="" fill sizes="120px" className="object-cover" unoptimized={!canOptimize(src)} />
            </button>
          ))}
        </div>
      )}
    </div>
  );
}