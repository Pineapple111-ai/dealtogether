export const IMG = {
  hero: "/images/hero-main.jpg",
  groupbuy: "/images/banner-groupbuy.jpg",
  store: "/images/banner-store.jpg",
};

/** 공간별 패키지 (categories.slug) */
const SPACE: Record<string, string> = {
  living: "/images/cat-living.jpg",
  kitchen: "/images/cat-kitchen.jpg",
  laundry: "/images/cat-laundry.jpg",
  aircare: "/images/cat-air.jpg",
  life: "/images/cat-life.jpg",
};

/** 쇼핑 분류 (products.store_category) */
const STORE: Record<string, string> = {
  video: "/images/cat-video.jpg",
  kitchen: "/images/cat-kitchen.jpg",
  laundry: "/images/cat-laundry.jpg",
  air: "/images/cat-air.jpg",
  life: "/images/cat-life.jpg",
};

export const spaceImage = (slug: string) => SPACE[slug] ?? null;
export const storeCategoryImage = (key: string) => STORE[key] ?? null;

/** Next.js 이미지 최적화가 가능한 주소인지 (사이트 내부 이미지, Supabase 저장소) */
const SUPABASE_HOST = (() => {
  try {
    return new URL(process.env.NEXT_PUBLIC_SUPABASE_URL ?? "").hostname;
  } catch {
    return "";
  }
})();

export function canOptimize(src: string) {
  if (src.startsWith("/")) return true;
  try {
    const u = new URL(src);
    return u.protocol === "https:" && u.hostname === SUPABASE_HOST && u.pathname.startsWith("/storage/v1/object/public/");
  } catch {
    return false;
  }
}