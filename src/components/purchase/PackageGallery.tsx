"use client";

import { useState } from "react";

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

  return (
    <div>
      <div className="aspect-square overflow-hidden rounded-xl bg-soft">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={images[idx]} alt={name} className="h-full w-full object-cover" />
      </div>
      {images.length > 1 && (
        <div className="mt-3 grid grid-cols-5 gap-2">
          {images.map((src, i) => (
            <button
              key={src}
              type="button"
              onClick={() => setIdx(i)}
              aria-label={`이미지 ${i + 1}`}
              className={`aspect-square overflow-hidden rounded-lg border-2 ${
                i === idx ? "border-navy" : "border-transparent"
              }`}
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={src} alt="" className="h-full w-full object-cover" />
            </button>
          ))}
        </div>
      )}
    </div>
  );
}