import { Suspense } from "react";
import { connection } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { requireStaff } from "@/lib/auth/staff";
import { won } from "@/lib/format";
import ActionForm, { SubmitButton } from "@/components/admin/ActionForm";
import { updateRule, updateMaxRate } from "./actions";

type Rule = {
  id: string;
  name: string;
  rule_type: "count" | "category" | "amount";
  tiers: { min: number; rate: number }[];
  is_active: boolean;
  sort_order: number;
};

const TYPE: Record<Rule["rule_type"], { label: string; unit: string; desc: string }> = {
  count: { label: "개수형", unit: "개 이상", desc: "할인 대상 상품 중 서로 다른 품목 수 (같은 상품 여러 대는 1개)" },
  category: { label: "카테고리 조합형", unit: "개 분류 이상", desc: "할인 대상 상품의 서로 다른 분류 수 (영상·주방·세탁·냉난방공기·생활)" },
  amount: { label: "합계 금액형", unit: "원 이상", desc: "할인 대상 상품의 판매가 합계 (설치비 등 부가 옵션 제외)" },
};

const input = "h-10 rounded-lg border border-line px-3 text-sm outline-none focus:border-navy";

export default function AdminDiscountsPage() {
  return (
    <div>
      <h1 className="text-2xl font-extrabold">세트 할인</h1>
      <p className="mt-1 text-sm text-sub">일반 쇼핑몰에서 여러 상품을 함께 담을 때 적용되는 할인입니다. 공동구매에는 적용되지 않습니다.</p>
      <Suspense fallback={<div className="mt-6 h-96 animate-pulse rounded-xl bg-white" />}>
        <DiscountsView />
      </Suspense>
    </div>
  );
}

async function DiscountsView() {
  await connection();
  await requireStaff("products");
  const sb = createAdminClient();
  const [{ data: rules }, { data: site }] = await Promise.all([
    sb.from("discount_rules").select("*").order("sort_order"),
    sb.from("site_settings").select("bundle_max_rate").eq("id", 1).single(),
  ]);
  const list = (rules ?? []) as Rule[];
  const max = Number(site?.bundle_max_rate ?? 10);

  // 계산 예시: 서로 다른 3품목, 2개 분류, 합계 600만원
  const sample = { count: 3, category: 2, amount: 6_000_000 };
  const applied = list
    .filter((r) => r.is_active)
    .map((r) => {
      const v = sample[r.rule_type];
      const tier = [...r.tiers].sort((a, b) => b.min - a.min).find((t) => v >= t.min);
      return { name: r.name, rate: tier?.rate ?? 0 };
    });
  const sum = applied.reduce((s, a) => s + a.rate, 0);
  const finalRate = Math.min(sum, max);

  return (
    <div className="mt-6 space-y-5">
      <section className="rounded-xl bg-white p-5">
        <h2 className="mb-3 font-bold">최대 할인율 상한</h2>
        <ActionForm action={updateMaxRate} className="flex flex-wrap items-end gap-3">
          <label className="text-[13px] font-semibold">
            상한 (%)
            <input name="bundle_max_rate" type="number" min={0} max={50} step={0.5} defaultValue={max} className={`${input} tabular mt-1 block w-28`} />
          </label>
          <SubmitButton>저장</SubmitButton>
          <span className="basis-full text-xs text-sub">사용 중인 규칙의 할인율을 모두 더한 뒤, 이 값을 넘으면 상한까지만 적용합니다.</span>
        </ActionForm>
      </section>

      {list.map((r) => {
        const t = TYPE[r.rule_type];
        const tiers = [...r.tiers].sort((a, b) => a.min - b.min);
        return (
          <section key={r.id} className={`rounded-xl bg-white p-5 ${r.is_active ? "ring-2 ring-navy/20" : ""}`}>
            <div className="mb-1 flex items-center gap-2">
              <span className="rounded bg-soft px-2 py-0.5 text-xs font-bold">{t.label}</span>
              <span className={`text-xs font-bold ${r.is_active ? "text-navy" : "text-sub"}`}>{r.is_active ? "사용 중" : "사용 안 함"}</span>
            </div>
            <p className="mb-4 text-xs text-sub">{t.desc}</p>

            <ActionForm action={updateRule} className="space-y-3">
              <input type="hidden" name="id" value={r.id} />
              <input type="hidden" name="rule_type" value={r.rule_type} />
              <div className="flex flex-wrap items-end gap-3">
                <label className="text-[13px] font-semibold">
                  규칙 이름 (고객에게 표시)
                  <input name="name" defaultValue={r.name} maxLength={40} className={`${input} mt-1 block w-64`} />
                </label>
                <label className="flex items-center gap-2 pb-2.5 text-sm font-semibold">
                  <input name="is_active" type="checkbox" defaultChecked={r.is_active} className="h-4 w-4 accent-[#102a43]" />
                  사용
                </label>
              </div>

              <div className="space-y-2">
                {Array.from({ length: 5 }).map((_, i) => (
                  <div key={i} className="flex flex-wrap items-center gap-2 text-sm">
                    <span className="tabular w-6 text-xs text-sub">{i + 1}</span>
                    <input
                      name={`min_${i}`}
                      type="number"
                      min={r.rule_type === "amount" ? 0 : 2}
                      step={r.rule_type === "amount" ? 10000 : 1}
                      defaultValue={tiers[i]?.min ?? ""}
                      className={`${input} tabular ${r.rule_type === "amount" ? "w-40" : "w-20"}`}
                    />
                    <span className="text-sub">{t.unit}</span>
                    <input name={`rate_${i}`} type="number" min={0} max={50} step={0.5} defaultValue={tiers[i]?.rate ?? ""} className={`${input} tabular w-20`} />
                    <span className="text-sub">% 할인</span>
                    {r.rule_type === "amount" && tiers[i] && <span className="tabular text-xs text-sub">({won(tiers[i].min)})</span>}
                  </div>
                ))}
              </div>
              <p className="text-xs text-sub">빈 줄은 무시됩니다. 기준이 높을수록 할인율도 같거나 높아야 합니다.</p>
              <SubmitButton>저장</SubmitButton>
            </ActionForm>
          </section>
        );
      })}

      <section className="rounded-xl bg-navy p-5 text-white">
        <h2 className="font-bold">계산 예시</h2>
        <p className="mt-1 text-sm text-white/70">할인 대상 상품 서로 다른 3품목 · 2개 분류 · 합계 {won(sample.amount)}을 담았을 때</p>
                <ul className="tabular mt-3 space-y-1 text-sm">
          {applied.length === 0 && <li className="text-white/70">사용 중인 규칙이 없습니다.</li>}
          {applied.map((a) => (
            <li key={a.name}>{a.name}: {a.rate}%</li>
          ))}
        </ul>
        <p className="tabular mt-3 border-t border-white/15 pt-3 font-bold">
          합계 {sum}% → 적용 {finalRate}%{sum > max && ` (상한 ${max}%)`} · 할인액 약 {won(Math.floor((sample.amount * finalRate) / 100 / 100) * 100)}
        </p>
      </section>
    </div>
  );
}