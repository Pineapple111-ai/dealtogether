import { Suspense } from "react";
import { connection } from "next/server";
import { redirect } from "next/navigation";
import { createAdminClient } from "@/lib/supabase/admin";
import { getStaff } from "@/lib/auth/staff";

type Daily = { day: string; views: number; visitors: number };
type Summary = { visitors: number; views: number; mobile_visitors: number };
type TopPage = { path: string; views: number; visitors: number };
type TopRef = { host: string; visitors: number };

const STATIC_LABEL: Record<string, string> = {
  "/": "메인",
  "/campaigns": "공동구매 목록",
  "/store": "가전 쇼핑",
  "/closing-soon": "마감 임박",
  "/categories": "공간별 패키지",
  "/brands/samsung": "삼성 가전",
  "/brands/lg": "LG 가전",
  "/guide": "이용안내",
  "/support": "고객센터",
  "/support/faq": "자주 묻는 질문",
  "/support/notices": "공지사항",
  "/support/inquiry": "1:1 문의",
  "/cart": "장바구니",
  "/login": "로그인",
  "/signup": "회원가입",
  "/mypage": "마이페이지",
  "/order-lookup": "비회원 주문조회",
};

const REF_LABEL: [RegExp, string][] = [
  [/naver\.com$/, "네이버"],
  [/google\./, "구글"],
  [/daum\.net$|kakao\.com$/, "다음·카카오"],
  [/instagram\.com$/, "인스타그램"],
  [/facebook\.com$/, "페이스북"],
  [/youtube\.com$/, "유튜브"],
];

const num = (n: number) => Number(n).toLocaleString("ko-KR");

export default function VisitorsPage() {
  return (
    <div>
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-extrabold">방문 통계</h1>
          <p className="mt-1 text-sm text-sub">고객 화면 방문 기준 · 관리자와 검색엔진 봇 제외 · 한국시간 기준</p>
        </div>
        <div className="flex gap-2">
          <a href="https://analytics.google.com" target="_blank" rel="noreferrer" className="rounded-lg border border-line bg-white px-3 py-2 text-sm font-semibold hover:border-navy/40">
            구글 애널리틱스 ↗
          </a>
          <a href="https://analytics.naver.com" target="_blank" rel="noreferrer" className="rounded-lg border border-line bg-white px-3 py-2 text-sm font-semibold hover:border-navy/40">
            네이버 애널리틱스 ↗
          </a>
        </div>
      </div>
      <Suspense fallback={<div className="mt-6 h-96 animate-pulse rounded-xl bg-white" />}>
        <Stats />
      </Suspense>
    </div>
  );
}

async function Stats() {
  await connection();
  const staff = await getStaff();
  if (!staff) redirect("/admin/login");

  const sb = createAdminClient();
  const [daily, s7, s30, pages, refs] = await Promise.all([
    sb.rpc("pv_daily", { p_days: 14 }),
    sb.rpc("pv_summary", { p_days: 7 }),
    sb.rpc("pv_summary", { p_days: 30 }),
    sb.rpc("pv_top_pages", { p_days: 7, p_limit: 10 }),
    sb.rpc("pv_top_referrers", { p_days: 7, p_limit: 10 }),
  ]);

  const days = (daily.data ?? []) as Daily[];
  const today = days[days.length - 1] ?? { views: 0, visitors: 0 };
  const yesterday = days[days.length - 2] ?? { views: 0, visitors: 0 };
  const w = ((s7.data ?? [])[0] ?? { visitors: 0, views: 0, mobile_visitors: 0 }) as Summary;
  const m = ((s30.data ?? [])[0] ?? { visitors: 0, views: 0, mobile_visitors: 0 }) as Summary;
  const top = (pages.data ?? []) as TopPage[];
  const referrers = (refs.data ?? []) as TopRef[];

  // 캠페인·상품 주소를 이름으로
  const slugs = top.map((p) => p.path.match(/^\/campaigns\/([a-z0-9-]+)$/)?.[1]).filter((x): x is string => !!x);
  const ids = top.map((p) => p.path.match(/^\/store\/([0-9a-f-]{36})$/i)?.[1]).filter((x): x is string => !!x);
  const [camps, prods] = await Promise.all([
    slugs.length ? sb.from("campaigns").select("slug, name").in("slug", slugs) : Promise.resolve({ data: [] }),
    ids.length ? sb.from("products").select("id, name").in("id", ids) : Promise.resolve({ data: [] }),
  ]);
  const campName = new Map(((camps.data ?? []) as { slug: string; name: string }[]).map((c) => [c.slug, c.name]));
  const prodName = new Map(((prods.data ?? []) as { id: string; name: string }[]).map((p) => [p.id, p.name]));

  const labelOf = (path: string) => {
    if (STATIC_LABEL[path]) return STATIC_LABEL[path];
    const c = path.match(/^\/campaigns\/([a-z0-9-]+)$/)?.[1];
    if (c) return `공동구매 · ${campName.get(c) ?? c}`;
    const p = path.match(/^\/store\/([0-9a-f-]{36})$/i)?.[1];
    if (p) return `상품 · ${prodName.get(p) ?? "삭제된 상품"}`;
    return path;
  };
  const refLabel = (host: string) => REF_LABEL.find(([r]) => r.test(host))?.[1] ?? host;

  const maxV = Math.max(1, ...days.map((d) => Number(d.visitors)));
  const diff = Number(today.visitors) - Number(yesterday.visitors);
  const mobileRate = m.visitors ? Math.round((Number(m.mobile_visitors) / Number(m.visitors)) * 100) : 0;

  const cards = [
    { label: "오늘 방문자", value: num(today.visitors), sub: `어제 ${num(yesterday.visitors)}명 (${diff >= 0 ? "+" : ""}${diff})` },
    { label: "오늘 페이지뷰", value: num(today.views), sub: `어제 ${num(yesterday.views)}` },
    { label: "최근 7일 방문자", value: num(w.visitors), sub: `페이지뷰 ${num(w.views)}` },
    { label: "최근 30일 방문자", value: num(m.visitors), sub: `모바일 ${mobileRate}%` },
  ];

  return (
    <div className="mt-6 space-y-5">
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {cards.map((c) => (
          <div key={c.label} className="rounded-xl bg-white p-5">
            <p className="text-[13px] text-sub">{c.label}</p>
            <p className="tabular mt-1 text-3xl font-extrabold text-navy">{c.value}</p>
            <p className="tabular mt-1 text-xs text-sub">{c.sub}</p>
          </div>
        ))}
      </div>

      {/* 14일 막대 */}
      <section className="rounded-xl bg-white p-5">
        <h2 className="font-bold">최근 14일 방문자</h2>
        <div className="mt-5 flex h-48 items-end gap-1.5">
          {days.map((d, i) => {
            const h = (Number(d.visitors) / maxV) * 100;
            const isToday = i === days.length - 1;
            return (
              <div key={d.day} className="group flex h-full flex-1 flex-col items-center justify-end">
                <span className="tabular mb-1 text-[11px] font-semibold text-sub">{num(d.visitors)}</span>
                <div
                  className={`w-full rounded-t ${isToday ? "bg-coral" : "bg-navy/80 group-hover:bg-navy"}`}
                  style={{ height: `${Math.max(h, Number(d.visitors) > 0 ? 3 : 1)}%` }}
                  title={`${d.day} · 방문자 ${d.visitors} · 페이지뷰 ${d.views}`}
                />
                <span className="tabular mt-1.5 text-[11px] text-sub">{d.day.slice(5).replace("-", ".")}</span>
              </div>
            );
          })}
        </div>
      </section>

      <div className="grid gap-5 lg:grid-cols-2">
        <section className="rounded-xl bg-white p-5">
          <h2 className="font-bold">많이 본 페이지 <span className="text-sm font-normal text-sub">최근 7일</span></h2>
          {top.length === 0 ? (
            <p className="py-10 text-center text-sm text-sub">아직 기록이 없습니다.</p>
          ) : (
            <table className="mt-3 w-full text-sm">
              <thead className="text-left text-xs text-sub">
                <tr><th className="py-2 font-semibold">페이지</th><th className="py-2 text-right font-semibold">조회</th><th className="py-2 text-right font-semibold">방문자</th></tr>
              </thead>
              <tbody className="tabular divide-y divide-line">
                {top.map((p, i) => (
                  <tr key={p.path}>
                    <td className="max-w-0 truncate py-2.5 pr-3">
                      <span className="mr-2 text-xs text-sub">{i + 1}</span>
                      <a href={p.path} target="_blank" rel="noreferrer" className="hover:text-navy hover:underline">{labelOf(p.path)}</a>
                    </td>
                    <td className="py-2.5 text-right">{num(p.views)}</td>
                    <td className="py-2.5 text-right text-sub">{num(p.visitors)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </section>

        <section className="rounded-xl bg-white p-5">
          <h2 className="font-bold">유입 사이트 <span className="text-sm font-normal text-sub">최근 7일 · 방문자 기준</span></h2>
          {referrers.length === 0 ? (
            <p className="py-10 text-center text-sm text-sub">외부 유입 기록이 없습니다. (주소 직접 입력·즐겨찾기 방문은 제외)</p>
          ) : (
            <ul className="mt-3 space-y-2.5">
              {referrers.map((r) => {
                const pct = (Number(r.visitors) / Math.max(1, Number(referrers[0].visitors))) * 100;
                return (
                  <li key={r.host} className="text-sm">
                    <div className="flex justify-between">
                      <span>{refLabel(r.host)} <span className="text-xs text-sub">{r.host}</span></span>
                      <span className="tabular font-semibold">{num(r.visitors)}</span>
                    </div>
                    <div className="mt-1 h-1.5 rounded-full bg-soft">
                      <div className="h-full rounded-full bg-navy" style={{ width: `${pct}%` }} />
                    </div>
                  </li>
                );
              })}
            </ul>
          )}
        </section>
      </div>
    </div>
  );
}