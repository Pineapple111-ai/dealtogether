"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import PhoneInput from "@/components/form/PhoneInput";
import { won } from "@/lib/format";
import { checkoutSchema } from "@/lib/checkout-schema";
import type { Quote } from "@/lib/pricing";

type DaumPostcodeData = { zonecode: string; roadAddress: string; jibunAddress: string; buildingName: string };
declare global {
  interface Window {
    daum?: { Postcode: new (o: { oncomplete: (d: DaumPostcodeData) => void }) => { open: () => void } };
  }
}

function loadPostcode(): Promise<void> {
  if (window.daum?.Postcode) return Promise.resolve();
  return new Promise((resolve, reject) => {
    const s = document.createElement("script");
    s.src = "https://t1.daumcdn.net/mapjsapi/bundle/postcode/prod/postcode.v2.js";
    s.onload = () => resolve();
    s.onerror = () => reject(new Error("주소 검색을 불러오지 못했습니다."));
    document.head.appendChild(s);
  });
}

type Props = {
  slug: string;
  selectionToken: string;
  quote: Quote;
  brandName: string;
  campaignName: string;
  packageName: string;
  showInstallation: boolean;
};

const inputCls =
  "h-12 w-full rounded-lg border border-line bg-white px-3.5 text-[15px] outline-none transition-colors focus:border-navy";

function Field({ label, required, error, children }: { label: string; required?: boolean; error?: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="mb-1.5 block text-[13px] font-semibold">
        {label}
        {required && <span className="ml-0.5 text-coral">*</span>}
      </span>
      {children}
      {error && <span className="mt-1 block text-xs font-semibold text-coral">{error}</span>}
    </label>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="rounded-xl border border-line bg-white p-5 md:p-6">
      <h2 className="mb-4 text-lg font-bold">{title}</h2>
      <div className="space-y-4">{children}</div>
    </section>
  );
}

export default function CheckoutForm(p: Props) {
  const router = useRouter();
  const [idempotencyKey] = useState(() => crypto.randomUUID());
  const [minDate, setMinDate] = useState("");
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [serverError, setServerError] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const [f, setF] = useState({
    buyerName: "",
    buyerPhone: "",
    buyerEmail: "",
    sameAsBuyer: true,
    recipientName: "",
    recipientPhone: "",
    zipcode: "",
    address1: "",
    address2: "",
    deliveryMemo: "",
    wishDate: "",
    elevator: "unknown" as "yes" | "no" | "unknown",
    floor: "",
    pickupOld: false,
    environment: "",
    installMemo: "",
    agreePrivacy: false,
    agreeOrder: false,
  });
  const set = <K extends keyof typeof f>(k: K, v: (typeof f)[K]) => setF((s) => ({ ...s, [k]: v }));

  useEffect(() => {
    const d = new Date(Date.now() + 86400_000);
    setMinDate(d.toLocaleDateString("sv-SE", { timeZone: "Asia/Seoul" }));
  }, []);

  const searchAddress = async () => {
    try {
      await loadPostcode();
      new window.daum!.Postcode({
        oncomplete: (d) => {
          setF((s) => ({
            ...s,
            zipcode: d.zonecode,
            address1: d.roadAddress + (d.buildingName ? ` (${d.buildingName})` : ""),
          }));
          document.getElementById("address2")?.focus();
        },
      }).open();
    } catch {
      setServerError("주소 검색을 불러오지 못했습니다. 잠시 후 다시 시도해주세요.");
    }
  };

  const buildForm = () => ({
    buyerName: f.buyerName,
    buyerPhone: f.buyerPhone,
    buyerEmail: f.buyerEmail,
    recipientName: f.sameAsBuyer ? f.buyerName : f.recipientName,
    recipientPhone: f.sameAsBuyer ? f.buyerPhone : f.recipientPhone,
    zipcode: f.zipcode,
    address1: f.address1,
    address2: f.address2,
    deliveryMemo: f.deliveryMemo,
    installation: p.showInstallation
      ? {
          wishDate: f.wishDate,
          elevator: f.elevator,
          floor: f.floor,
          pickupOld: f.pickupOld,
          environment: f.environment,
          memo: f.installMemo,
        }
      : undefined,
    agreePrivacy: f.agreePrivacy,
    agreeOrder: f.agreeOrder,
  });

  const submit = async (expectedTotal = p.quote.grandTotal) => {
    setServerError("");
    const parsed = checkoutSchema.safeParse(buildForm());
    if (!parsed.success) {
      const map: Record<string, string> = {};
      for (const issue of parsed.error.issues) {
        const key = String(issue.path[0]);
        if (!map[key]) map[key] = issue.message;
      }
      setErrors(map);
      document.querySelector("[data-error='true']")?.scrollIntoView({ behavior: "smooth", block: "center" });
      return;
    }
    setErrors({});
    setSubmitting(true);

    try {
      const res = await fetch("/api/orders", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          campaignSlug: p.slug,
          selection: p.selectionToken,
          idempotencyKey,
          expectedTotal,
          form: parsed.data,
        }),
      });
      const json = await res.json();

      if (res.ok) {
        router.replace(`/orders/${json.orderNumber}/pay?t=${json.token}`);
        return;
      }
      if (json.code === "PRICE_CHANGED") {
        const agree = window.confirm(
          `주문 금액이 변경되었습니다.\n변경된 금액: ${won(json.newTotal)}\n이 금액으로 주문을 진행할까요?`
        );
        if (agree) return submit(json.newTotal);
        setServerError("금액이 변경되어 주문이 진행되지 않았습니다. 상품 페이지에서 다시 확인해주세요.");
      } else {
        setServerError(json.message ?? "주문 생성 중 오류가 발생했습니다.");
      }
    } catch {
      setServerError("네트워크 오류가 발생했습니다. 다시 시도하면 중복 주문 없이 이어서 처리됩니다.");
    }
    setSubmitting(false);
  };

  const q = p.quote;
  const priceRows: [string, number][] = [
    [`공동구매가 × ${q.quantity}`, q.basePrice],
    ["옵션 추가 금액", q.optionTotal],
    ["선택 구성품", q.optionalItemTotal],
    ["설치·부가 옵션", q.installationFee],
    ["배송비", q.shippingFee],
  ];

  const SubmitButton = ({ className }: { className: string }) => (
    <button
      type="button"
      onClick={() => submit()}
      disabled={submitting}
      className={`rounded-xl bg-navy font-bold text-white transition-colors hover:bg-navy-700 disabled:bg-sub ${className}`}
    >
      {submitting ? "주문 생성 중..." : "안전결제 진행하기"}
    </button>
  );

  return (
    <div className="mx-auto max-w-site px-4 pb-28 pt-8 md:px-6 lg:pb-0">
      <h1 className="text-2xl font-extrabold tracking-tight md:text-[28px]">주문서 작성</h1>

      <div className="mt-6 grid gap-6 lg:grid-cols-[minmax(0,1fr)_420px] lg:gap-10">
        {/* 주문 상품 + 금액 (모바일 상단, PC 우측) */}
        <aside className="order-first lg:order-last">
          <div className="space-y-4 lg:sticky lg:top-28">
            <section className="rounded-xl border border-line bg-white p-5">
              <p className="text-[13px] font-bold text-sub">{p.brandName}</p>
              <p className="mt-0.5 text-xs text-sub">{p.campaignName}</p>
              <h2 className="mt-1 text-lg font-bold">{p.packageName}</h2>
              <ul className="mt-4 space-y-3 border-t border-line pt-4 text-sm">
                {q.lines.map((l) => (
                  <li key={l.packageItemId}>
                    <p className="font-semibold">
                      {l.itemLabel}
                      {l.isOptional && <span className="ml-1 text-xs font-normal text-sub">(선택)</span>}
                      <span className="tabular ml-1 font-normal text-sub">× {l.quantity}</span>
                    </p>
                    <p className="text-[13px] text-sub">
                      {l.modelName} ({l.modelCode})
                    </p>
                    <p className="text-[13px] text-sub">
                      {Object.entries(l.attributes).map(([k, v]) => `${k} ${v}`).join(", ")}
                      {l.addons.length > 0 && ` · ${l.addons.map((a) => a.label).join(", ")}`}
                    </p>
                  </li>
                ))}
              </ul>
            </section>

            <section className="rounded-xl border border-line bg-white p-5">
              <dl className="tabular space-y-2 text-sm">
                {priceRows.map(([k, v]) => (
                  <div key={k} className="flex justify-between">
                    <dt className="text-sub">{k}</dt>
                    <dd>{v > 0 ? won(v) : k === "배송비" ? "무료" : "0원"}</dd>
                  </div>
                ))}
              </dl>
              <div className="mt-4 flex items-baseline justify-between border-t border-line pt-4">
                <span className="font-bold">최종 결제 예정금액</span>
                <span className="tabular text-2xl font-extrabold text-navy">{won(q.grandTotal)}</span>
              </div>
              {q.quoteRequired && (
                <p className="mt-3 text-xs text-sub">현장 견적 옵션이 포함되어 설치 시 추가 비용이 발생할 수 있습니다.</p>
              )}
              <SubmitButton className="mt-5 hidden h-14 w-full text-base lg:block" />
              <p className="mt-3 text-xs leading-relaxed text-sub">
                주문 생성 후 외부 안전결제 페이지로 이동합니다. 결제가 확인되어야 공동구매 참여가 확정됩니다.
              </p>
            </section>
          </div>
        </aside>

        {/* 입력 폼 */}
        <div className="space-y-5">
          <Section title="주문자 정보">
            <div data-error={!!errors.buyerName}>
              <Field label="이름" required error={errors.buyerName}>
                <input className={inputCls} value={f.buyerName} onChange={(e) => set("buyerName", e.target.value)} autoComplete="name" maxLength={30} />
              </Field>
            </div>
            <div data-error={!!errors.buyerPhone}>
              <Field label="휴대폰 번호" required error={errors.buyerPhone}>
                <PhoneInput className={inputCls} value={f.buyerPhone} onChange={(v) => set("buyerPhone", v)} />
              </Field>
            </div>
            <div data-error={!!errors.buyerEmail}>
              <Field label="이메일" error={errors.buyerEmail}>
                <input type="email" className={inputCls} value={f.buyerEmail} onChange={(e) => set("buyerEmail", e.target.value)} autoComplete="email" placeholder="주문 안내 수신용 (선택)" />
              </Field>
            </div>
          </Section>

          <Section title="배송지 정보">
            <label className="flex items-center gap-2 text-sm font-semibold">
              <input type="checkbox" className="h-5 w-5 accent-[#102a43]" checked={f.sameAsBuyer} onChange={(e) => set("sameAsBuyer", e.target.checked)} />
              주문자와 동일
            </label>
            {!f.sameAsBuyer && (
              <div className="grid gap-4 sm:grid-cols-2">
                <div data-error={!!errors.recipientName}>
                  <Field label="수령인" required error={errors.recipientName}>
                    <input className={inputCls} value={f.recipientName} onChange={(e) => set("recipientName", e.target.value)} maxLength={30} />
                  </Field>
                </div>
                <div data-error={!!errors.recipientPhone}>
                  <Field label="연락처" required error={errors.recipientPhone}>
                    <PhoneInput className={inputCls} value={f.recipientPhone} onChange={(v) => set("recipientPhone", v)} />
                  </Field>
                </div>
              </div>
            )}
            <div data-error={!!(errors.zipcode || errors.address1)}>
              <Field label="주소" required error={errors.zipcode || errors.address1}>
                <div className="flex gap-2">
                  <input className={`${inputCls} max-w-32 bg-soft`} value={f.zipcode} readOnly placeholder="우편번호" />
                  <button type="button" onClick={searchAddress} className="h-12 shrink-0 rounded-lg border border-navy px-4 text-sm font-bold text-navy hover:bg-navy/5">
                    주소 검색
                  </button>
                </div>
              </Field>
              <input className={`${inputCls} mt-2 bg-soft`} value={f.address1} readOnly placeholder="주소 검색을 눌러주세요" onClick={searchAddress} />
              <input id="address2" className={`${inputCls} mt-2`} value={f.address2} onChange={(e) => set("address2", e.target.value)} placeholder="상세주소 (동·호수)" maxLength={100} />
            </div>
            <Field label="배송 요청사항">
              <input className={inputCls} value={f.deliveryMemo} onChange={(e) => set("deliveryMemo", e.target.value)} maxLength={200} placeholder="예: 방문 전 연락 부탁드립니다" />
            </Field>
          </Section>

          {p.showInstallation && (
            <Section title="설치 정보">
              <div className="grid gap-4 sm:grid-cols-2">
                <Field label="설치 희망일">
                  <input type="date" className={inputCls} value={f.wishDate} min={minDate} onChange={(e) => set("wishDate", e.target.value)} />
                </Field>
                <Field label="설치 층수">
                  <input className={inputCls} value={f.floor} onChange={(e) => set("floor", e.target.value.replace(/[^0-9B-]/gi, "").slice(0, 10))} placeholder="예: 12" inputMode="numeric" />
                </Field>
              </div>
              <p className="-mt-2 text-xs text-sub">희망일은 확정 일정이 아니며, 결제 확인 후 일정을 조율해 안내드립니다.</p>

              <div>
                <p className="mb-1.5 text-[13px] font-semibold">엘리베이터</p>
                <div className="flex gap-2">
                  {([["yes", "있음"], ["no", "없음"], ["unknown", "잘 모름"]] as const).map(([v, label]) => (
                    <button
                      key={v}
                      type="button"
                      onClick={() => set("elevator", v)}
                      aria-pressed={f.elevator === v}
                      className={`h-11 flex-1 rounded-lg border text-sm ${f.elevator === v ? "border-navy bg-navy/5 font-semibold text-navy ring-1 ring-navy" : "border-line"}`}
                    >
                      {label}
                    </button>
                  ))}
                </div>
              </div>

              <label className="flex items-center gap-2 text-sm font-semibold">
                <input type="checkbox" className="h-5 w-5 accent-[#102a43]" checked={f.pickupOld} onChange={(e) => set("pickupOld", e.target.checked)} />
                기존 제품 수거 요청
              </label>

              <Field label="설치 환경">
                <input className={inputCls} value={f.environment} onChange={(e) => set("environment", e.target.value)} maxLength={200} placeholder="예: 벽체 콘크리트, 기존 배관 있음" />
              </Field>
              <Field label="추가 요청사항">
                <textarea className={`${inputCls} h-24 py-3`} value={f.installMemo} onChange={(e) => set("installMemo", e.target.value)} maxLength={300} />
              </Field>
            </Section>
          )}

          <Section title="약관 동의">
            <div data-error={!!errors.agreePrivacy}>
              <label className="flex items-start gap-2 text-sm">
                <input type="checkbox" className="mt-0.5 h-5 w-5 accent-[#102a43]" checked={f.agreePrivacy} onChange={(e) => set("agreePrivacy", e.target.checked)} />
                <span>
                  <b>[필수]</b> 개인정보 수집·이용 동의
                  <span className="block text-xs text-sub">수집 항목: 이름, 휴대폰 번호, 이메일, 주소 / 목적: 주문 처리, 배송·설치, 고객 응대</span>
                </span>
              </label>
              {errors.agreePrivacy && <p className="mt-1 text-xs font-semibold text-coral">{errors.agreePrivacy}</p>}
            </div>
            <div data-error={!!errors.agreeOrder}>
              <label className="flex items-start gap-2 text-sm">
                <input type="checkbox" className="mt-0.5 h-5 w-5 accent-[#102a43]" checked={f.agreeOrder} onChange={(e) => set("agreeOrder", e.target.checked)} />
                <span>
                  <b>[필수]</b> 주문 내용 및 결제 조건 확인
                  <span className="block text-xs text-sub">결제는 외부 안전결제 서비스에서 진행되며, 결제 확인 후 주문이 확정됩니다.</span>
                </span>
              </label>
              {errors.agreeOrder && <p className="mt-1 text-xs font-semibold text-coral">{errors.agreeOrder}</p>}
            </div>
          </Section>

          {serverError && (
            <p className="rounded-xl bg-coral/10 p-4 text-sm font-semibold text-coral" role="alert">
              {serverError}
            </p>
          )}
        </div>
      </div>

      {/* 모바일 하단 고정 */}
      <div className="fixed inset-x-0 bottom-0 z-30 border-t border-line bg-white px-4 py-3 pb-[max(12px,env(safe-area-inset-bottom))] lg:hidden">
        <div className="flex items-center gap-3">
          <div className="min-w-0 flex-1">
            <p className="text-xs text-sub">최종 결제 예정금액</p>
            <p className="tabular truncate text-lg font-extrabold text-navy">{won(q.grandTotal)}</p>
          </div>
          <SubmitButton className="h-12 shrink-0 px-6" />
        </div>
      </div>
    </div>
  );
}