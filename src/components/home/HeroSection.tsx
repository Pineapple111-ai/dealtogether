import { getActiveBanners } from "@/lib/queries/banners";
import HeroSlider from "./HeroSlider";
import StaticHero from "./StaticHero";

export default async function HeroSection() {
  const banners = await getActiveBanners();
  if (banners.length === 0) return <StaticHero />;
  return <HeroSlider banners={banners} />;
}