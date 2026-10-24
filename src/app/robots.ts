import type { MetadataRoute } from "next";
import { SITE_URL } from "@/lib/site";

export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      {
        userAgent: "*",
        allow: "/",
        // 개인 정보·관리·주문 관련 화면은 검색 제외
        disallow: [
          "/admin", "/api", "/auth", "/mypage", "/cart", "/checkout", "/orders",
          "/order-lookup", "/compare", "/login", "/signup", "/search",
        ],
      },
    ],
    sitemap: `${SITE_URL}/sitemap.xml`,
    host: SITE_URL,
  };
}