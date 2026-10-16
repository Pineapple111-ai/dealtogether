"use client";

import { won } from "@/lib/format";
import { groupsFor, defaultAddons, type DetailItem, type DetailSku, type ItemSelection } from "@/lib/pricing";

type Props = {
  item: DetailItem;
  value: ItemSelection;
  need: number; // 이 구성품에 필요한 수량 (세트수 × 세트당 수량)
  onChange: (v: ItemSelection) => void;
  plain?: boolean; // 쇼핑몰 상세: 구성품 헤더 숨김
};

/** 고정 조건을 만족하는 SKU 중 가장 적합한 것 선택 */
function pickSku(
  item: DetailItem,
  modelId: string,
  fixed: Record<string, string>,
  prefer: Record<string, string>,
  need: number
): DetailSku | undefined {
  const pool = item.skus.filter(
    (s) => s.modelId === modelId && Object.entries(fixed).every(([k, v]) => s.attributes[k] === v)
  );
  const score = (s: DetailSku) => item.attributeKeys.filter((k) => s.attributes[k] === prefer[k]).length;
  return [...pool].sort(
    (a, b) =>
      Number(b.available >= need) - Number(a.available >= need) ||
      score(b) - score(a) ||
      Number(b.isDefault) - Number(a.isDefault) ||
      a.adjustment - b.adjustment
  )[0];
}

function Pill({
  selected,
  disabled,
  onClick,
  children,
}: {
  selected: boolean;
  disabled?: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      aria-pressed={selected}
      className={`min-h-11 rounded-lg border px-3.5 py-2 text-left text-sm transition-colors ${
        selected
          ? "border-navy bg-navy/5 font-semibold text-navy ring-1 ring-navy"
          : "border-line bg-white hover:border-navy/40"
      } ${disabled ? "cursor-not-allowed opacity-40 line-through" : ""}`}
    >
      {children}
    </button>
  );
}

const plus = (n: number) => (n > 0 ? ` +${won(n)}` : "");

export default function ItemSelector({ item, value, need, onChange, plain = false }: Props) {
  const sku = item.skus.find((s) => s.id === value.skuId);
  const included = item.isRequired || value.included;
  const models = item.models.filter((m) => item.skus.some((s) => s.modelId === m.id));

  const setSku = (next?: DetailSku) => {
    if (!next) return;
    const sameProduct = (next.productId ?? null) === (sku?.productId ?? null);
    onChange({
      ...value,
      skuId: next.id,
      addons: sameProduct ? value.addons : defaultAddons(groupsFor(item, next)),
    });
  };

  const toggleAddon = (groupId: string, valueId: string, single: boolean, required: boolean) => {
    const cur = value.addons[groupId] ?? [];
    let next: string[];
    if (single) next = cur.includes(valueId) && !required ? [] : [valueId];
    else next = cur.includes(valueId) ? cur.filter((x) => x !== valueId) : [...cur, valueId];
    onChange({ ...value, addons: { ...value.addons, [groupId]: next } });
  };

  return (
    <section className="rounded-xl border border-line bg-white">
      {/* 헤더 */}
      <div className={`flex items-start justify-between gap-3 p-5 ${plain ? "hidden" : ""}`}>
        <div>
          <div className="flex items-center gap-2">
            <h3 className="text-[17px] font-bold">{item.label}</h3>
            <span
              className={`rounded px-1.5 py-0.5 text-[11px] font-bold ${
                item.isRequired ? "bg-navy text-white" : "bg-soft text-sub"
              }`}
            >
              {item.isRequired ? "필수" : "선택"}
            </span>
            {item.quantity > 1 && <span className="text-xs text-sub">세트당 {item.quantity}대</span>}
          </div>
          {included && sku && (
            <p className="mt-1 text-[13px] text-sub">
              {item.models.find((m) => m.id === sku.modelId)?.name} · {sku.sku}
            </p>
          )}
        </div>

        {!item.isRequired && (
          <label className="flex shrink-0 cursor-pointer items-center gap-2 text-sm font-semibold">
            <input
              type="checkbox"
              checked={value.included}
              onChange={(e) => onChange({ ...value, included: e.target.checked })}
              className="h-5 w-5 accent-[#102a43]"
            />
            추가{item.optionalPrice > 0 && ` +${won(item.optionalPrice)}`}
          </label>
        )}
      </div>

      {included && (
        <div className={`space-y-5 p-5 ${plain ? "" : "border-t border-line"}`}>
          {/* 모델 */}
          {models.length > 0 && (
            <div>
              <p className="mb-2 text-[13px] font-semibold text-sub">모델</p>
              <div className="grid gap-2 sm:grid-cols-2">
                {models.map((m) => {
                  const mSkus = item.skus.filter((s) => s.modelId === m.id);
                  const minAdj = Math.min(...mSkus.map((s) => s.adjustment));
                  const soldOut = mSkus.every((s) => s.available < need);
                  return (
                    <Pill
                      key={m.id}
                      selected={sku?.modelId === m.id}
                      disabled={soldOut}
                      onClick={() => setSku(pickSku(item, m.id, {}, sku?.attributes ?? {}, need))}
                    >
                      <span className="block">{m.name}</span>
                      <span className="block text-xs font-normal text-sub">
                        {m.code}
                        {soldOut ? " · 품절" : minAdj > 0 ? ` · +${won(minAdj)}~` : ""}
                      </span>
                    </Pill>
                  );
                })}
              </div>
            </div>
          )}

          {/* 종속 속성 (크기 → 색상 …) */}
          {sku &&
            item.attributeKeys.map((key, i) => {
              const prevKeys = item.attributeKeys.slice(0, i);
              const pool = item.skus.filter(
                (s) => s.modelId === sku.modelId && prevKeys.every((k) => s.attributes[k] === sku.attributes[k])
              );
              const values = [...new Set(pool.map((s) => s.attributes[key]).filter(Boolean))];
              if (values.length === 0) return null;

              return (
                <div key={key}>
                  <p className="mb-2 text-[13px] font-semibold text-sub">{key}</p>
                  <div className="flex flex-wrap gap-2">
                    {values.map((val) => {
                      const cands = pool.filter((s) => s.attributes[key] === val);
                      const soldOut = cands.every((s) => s.available < need);
                      const adj = Math.min(...cands.map((s) => s.adjustment));
                      const fixed = Object.fromEntries([...prevKeys.map((k) => [k, sku.attributes[k]]), [key, val]]);
                      return (
                        <Pill
                          key={val}
                          selected={sku.attributes[key] === val}
                          disabled={soldOut}
                          onClick={() => setSku(pickSku(item, sku.modelId, fixed, sku.attributes, need))}
                        >
                          {val}
                          {soldOut ? " (품절)" : plus(adj)}
                        </Pill>
                      );
                    })}
                  </div>
                </div>
              );
            })}

          {sku && sku.available < need && (
            <p className="rounded-lg bg-coral/10 px-3 py-2 text-[13px] font-semibold text-coral">
              선택한 옵션의 재고가 부족합니다. 다른 옵션을 선택해주세요.
            </p>
          )}

          {/* 설치·부가 옵션 */}
          {groupsFor(item, sku).map((g) => {
            const picked = value.addons[g.id] ?? [];
            const single = g.selectType === "single";
            return (
              <div key={g.id}>
                <p className="mb-2 text-[13px] font-semibold text-sub">
                  {g.name}
                  {g.isRequired && <span className="ml-1 text-coral">*</span>}
                  {!single && <span className="ml-1 font-normal">(복수 선택)</span>}
                </p>
                <div className="flex flex-wrap gap-2">
                  {g.values.map((v) => (
                    <Pill
                      key={v.id}
                      selected={picked.includes(v.id)}
                      onClick={() => toggleAddon(g.id, v.id, single, g.isRequired)}
                    >
                      {v.label}
                      {plus(v.price)}
                      {v.isQuoteRequired && <span className="ml-1 text-xs text-sub">(현장 견적)</span>}
                    </Pill>
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </section>
  );
}