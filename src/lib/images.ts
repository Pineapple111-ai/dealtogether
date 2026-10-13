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