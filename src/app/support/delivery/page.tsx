import type { Metadata } from "next";

export const metadata: Metadata = { title: "배송·설치 안내" };

const FLOW = ["결제 완료", "상품 준비", "배송 일정 조율", "배송", "설치 일정 확정", "설치 완료"];

export default function DeliveryPage() {
  return (
    <div className="mx-auto max-w-3xl px-4 py-12 md:py-16">
      <h1 className="text-2xl font-extrabold tracking-tight md:text-3xl">배송·설치 안내</h1>

      <ol className="mt-8 flex flex-wrap gap-2">
        {FLOW.map((s, i) => (
          <li key={s} className="rounded-full bg-soft px-4 py-2 text-sm font-semibold">
            <span className="tabular mr-1 text-coral">{i + 1}</span>{s}
          </li>
        ))}
      </ol>

      <div className="mt-8 space-y-4 text-[15px] leading-relaxed text-ink/85">
        <p>대형 가전은 결제 확인 후 배송·설치 일정을 개별로 조율해 안내드립니다. 주문서에 입력한 설치 희망일은 참고용이며 확정 일정이 아닙니다.</p>
        <p>설치가 필요한 제품은 설치 기사가 방문합니다. 엘리베이터 유무, 설치 층수, 설치 환경 정보를 정확히 입력해주시면 일정 조율에 도움이 됩니다.</p>
        <p>벽걸이 설치, 추가 배관 등 선택한 옵션의 비용은 주문 금액에 포함됩니다. 현장 견적이 필요한 옵션이나 현장 환경에 따라 추가 비용이 발생하는 경우, 설치 전에 안내드립니다.</p>
        <p>기존 제품 수거를 요청하신 경우 설치 일정에 맞춰 함께 진행됩니다.</p>
      </div>
    </div>
  );
}