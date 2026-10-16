"use client";

import { useState } from "react";
import { Download, Upload } from "lucide-react";
import type { ImportResult } from "@/lib/admin/import";

const PRODUCT_HEADERS = [
  "브랜드", "제품종류", "제품명", "선택항목", "모델코드", "모델명", "SKU코드", "옵션값", "재고",
  "정상가", "판매가", "판매상태", "쇼핑몰분류", "쇼핑몰노출", "세트할인", "모델이미지", "대표이미지", "요약", "설명",
];
const OPTION_HEADERS = ["브랜드", "제품명", "옵션그룹", "선택방식", "필수", "옵션명", "추가금", "기본선택", "현장견적"];

const GUIDE = [
  ["딜투게더 상품 일괄 등록 작성방법"],
  [""],
  ["[상품 시트] 1줄 = 1개 SKU(실제 판매 조합). 같은 제품의 SKU가 여러 개면 제품명을 반복해서 적습니다."],
  ["브랜드: 등록된 브랜드명 (예: 삼성전자, LG전자)"],
  ["선택항목: 고객이 고르는 순서, | 로 구분 (예: 화면 크기|색상). 같은 제품은 모든 줄이 같아야 합니다."],
  ["옵션값: 선택항목 순서대로 | 로 구분 (예: 65인치|블랙). 선택항목이 없으면 비워둡니다."],
  ["SKU코드: 영문 대문자·숫자·하이픈. 사이트 전체에서 중복 불가."],
  ["재고: 파일 값으로 덮어씁니다."],
  ["판매가: 쇼핑몰 판매가. 비우면 기존 값 유지, 0이면 쇼핑몰 판매 중지. 정상가를 비우면 판매가와 같게 저장."],
  ["판매상태: 판매중 / 품절 / 숨김 (비우면 기존 값, 신규는 판매중)"],
  ["쇼핑몰분류: 영상가전 / 주방가전 / 세탁가전 / 냉난방·공기 / 생활가전"],
  ["쇼핑몰노출, 세트할인: Y 또는 N (비우면 기존 값, 신규는 노출 N · 세트할인 Y)"],
  ["모델이미지, 대표이미지: https:// 로 시작하는 이미지 주소 (선택)"],
  [""],
  ["[옵션 시트] 1줄 = 옵션 1개. 설치 방식, 벽걸이 종류, 설치 키트 등 추가금이 붙는 선택."],
  ["선택방식: 단일 또는 복수 / 필수, 기본선택, 현장견적: Y 또는 N"],
  ["옵션 시트에 적은 제품은 이 시트 내용이 기준이 됩니다. 시트에 없는 기존 옵션은 숨김 처리됩니다."],
  ["옵션 시트에 없는 제품의 옵션은 변경되지 않습니다."],
  [""],
  ["※ 브랜드+제품명이 같으면 같은 제품, 모델코드가 같으면 같은 모델, SKU코드가 같으면 같은 SKU로 보고 업데이트합니다."],
  ["※ 파일에 없는 기존 제품·모델·SKU는 삭제되지 않습니다."],
];

type Parsed = { fileName: string; products: Record<string, unknown>[]; options: Record<string, unknown>[] };

export default function ImportTool() {
  const [parsed, setParsed] = useState<Parsed | null>(null);
  const [result, setResult] = useState<ImportResult | null>(null);
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(false);

  const downloadTemplate = async () => {
    const XLSX = await import("xlsx");
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(
      wb,
      XLSX.utils.aoa_to_sheet([
        PRODUCT_HEADERS,
        ["LG전자", "TV", "예시 OLED TV", "화면 크기|색상", "EX-OLED-A", "예시 OLED A", "EX-OLED-A-65-BK", "65인치|블랙", 20, 3290000, 2890000, "판매중", "영상가전", "Y", "Y", "", "", "4K OLED · 120Hz", ""],
        ["LG전자", "TV", "예시 OLED TV", "화면 크기|색상", "EX-OLED-A", "예시 OLED A", "EX-OLED-A-77-BK", "77인치|블랙", 10, 4590000, 3990000, "판매중", "영상가전", "Y", "Y", "", "", "", ""],
        ["삼성전자", "세탁기", "예시 드럼세탁기", "용량|색상", "EX-WM-01", "예시 드럼세탁기", "EX-WM-01-24-WH", "24kg|화이트", 15, 1890000, 1650000, "판매중", "세탁가전", "Y", "Y", "", "", "", ""],
      ]),
      "상품"
    );
    XLSX.utils.book_append_sheet(
      wb,
      XLSX.utils.aoa_to_sheet([
        OPTION_HEADERS,
        ["LG전자", "예시 OLED TV", "설치 방식", "단일", "Y", "스탠드형", 0, "Y", "N"],
        ["LG전자", "예시 OLED TV", "설치 방식", "단일", "Y", "일반 벽걸이", 80000, "N", "N"],
        ["LG전자", "예시 OLED TV", "설치 방식", "단일", "Y", "슬림 벽걸이", 120000, "N", "N"],
        ["삼성전자", "예시 드럼세탁기", "추가 옵션", "복수", "N", "직렬 설치 키트", 50000, "N", "N"],
      ]),
      "옵션"
    );
    XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(GUIDE), "작성방법");
    XLSX.writeFile(wb, "딜투게더_상품등록_양식.xlsx");
  };

  const call = async (p: Parsed, apply: boolean) => {
    setLoading(true);
    setMessage("");
    try {
      const res = await fetch("/api/admin/import", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ apply, products: p.products, options: p.options }),
      });
      const json = await res.json();
      if (!res.ok) {
        setMessage(json.message ?? "처리 중 오류가 발생했습니다.");
        setResult(null);
      } else {
        setResult(json);
        if (json.applied) setMessage("적용이 완료되었습니다.");
      }
    } catch {
      setMessage("네트워크 오류가 발생했습니다.");
    }
    setLoading(false);
  };

  const onFile = async (file: File) => {
    setResult(null);
    setMessage("");
    try {
      const XLSX = await import("xlsx");
      const wb = XLSX.read(await file.arrayBuffer());
      const productSheet = wb.Sheets["상품"] ?? wb.Sheets[wb.SheetNames[0]];
      const optionSheet = wb.Sheets["옵션"];
      const toRows = (ws: import("xlsx").WorkSheet | undefined) =>
        ws ? XLSX.utils.sheet_to_json<Record<string, unknown>>(ws, { defval: "", raw: false }) : [];
      const p: Parsed = { fileName: file.name, products: toRows(productSheet), options: toRows(optionSheet) };
      setParsed(p);
      await call(p, false);
    } catch {
      setMessage("파일을 읽지 못했습니다. 엑셀(.xlsx) 또는 CSV 파일인지 확인해주세요.");
    }
  };

  const S = result?.summary;
  const stats: [string, string][] = S
    ? [
        ["제품", `신규 ${S.products.create} · 수정 ${S.products.update}`],
        ["모델", `신규 ${S.models.create} · 수정 ${S.models.update}`],
        ["SKU", `신규 ${S.skus.create} · 수정 ${S.skus.update}`],
        ["쇼핑몰 판매가", `등록·수정 ${S.prices.set} · 판매 중지 ${S.prices.remove}`],
        ["옵션그룹", `신규 ${S.optionGroups.create} · 수정 ${S.optionGroups.update}`],
        ["옵션", `신규 ${S.optionValues.create} · 수정 ${S.optionValues.update} · 숨김 ${S.optionValues.deactivate}`],
      ]
    : [];

  return (
    <div className="space-y-5">
      <section className="rounded-xl bg-white p-5">
        <h2 className="font-bold">1. 양식 내려받기</h2>
        <p className="mt-1 text-sm text-sub">상품 · 옵션 · 작성방법 시트가 들어 있는 엑셀 양식입니다. 예시 행은 지우고 작성하세요.</p>
        <button type="button" onClick={downloadTemplate} className="mt-3 inline-flex h-10 items-center gap-2 rounded-lg border border-navy px-4 text-sm font-bold text-navy hover:bg-navy/5">
          <Download size={16} /> 양식 다운로드 (.xlsx)
        </button>
      </section>

      <section className="rounded-xl bg-white p-5">
        <h2 className="font-bold">2. 파일 올리기</h2>
        <p className="mt-1 text-sm text-sub">올리면 바로 저장되지 않고 미리보기로 검사합니다. CSV는 상품 시트만 등록됩니다.</p>
        <label className="mt-3 inline-flex h-10 cursor-pointer items-center gap-2 rounded-lg bg-navy px-4 text-sm font-bold text-white hover:bg-navy-700">
          <Upload size={16} /> 파일 선택
          <input
            type="file"
            accept=".xlsx,.xls,.csv"
            className="hidden"
            onChange={(e) => {
              const f = e.target.files?.[0];
              if (f) onFile(f);
              e.target.value = "";
            }}
          />
        </label>
        {parsed && (
          <p className="tabular mt-2 text-sm text-sub">
            {parsed.fileName} · 상품 {parsed.products.length}행 · 옵션 {parsed.options.length}행
          </p>
        )}
      </section>

      {loading && <p className="rounded-xl bg-white p-5 text-sm text-sub">검사 중입니다...</p>}
      {message && (
        <p className={`rounded-xl p-4 text-sm font-semibold ${result?.applied ? "bg-navy text-white" : "bg-coral/10 text-coral"}`}>{message}</p>
      )}

      {result && !loading && (
        <section className="rounded-xl bg-white p-5">
          <h2 className="font-bold">3. {result.applied ? "적용 결과" : "미리보기"}</h2>
          <dl className="tabular mt-3 grid gap-2 text-sm sm:grid-cols-2 lg:grid-cols-3">
            {stats.map(([k, v]) => (
              <div key={k} className="rounded-lg bg-soft p-3">
                <dt className="text-xs text-sub">{k}</dt>
                <dd className="mt-0.5 font-semibold">{v}</dd>
              </div>
            ))}
          </dl>

          {result.issues.length > 0 ? (
            <>
              <p className="mt-4 text-sm font-bold text-coral">
                오류 {result.issues.length}건 — 파일을 고친 뒤 다시 올려주세요. 오류가 있으면 적용할 수 없습니다.
              </p>
              <div className="mt-2 max-h-80 overflow-auto rounded-lg border border-line">
                <table className="w-full text-sm">
                  <thead className="sticky top-0 bg-soft text-left text-xs text-sub">
                    <tr>
                      <th className="px-3 py-2">시트</th>
                      <th className="px-3 py-2">행</th>
                      <th className="px-3 py-2">내용</th>
                    </tr>
                  </thead>
                  <tbody className="tabular divide-y divide-line">
                    {result.issues.map((i, idx) => (
                      <tr key={idx}>
                        <td className="px-3 py-2">{i.sheet}</td>
                        <td className="px-3 py-2">{i.row}</td>
                        <td className="px-3 py-2">{i.message}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </>
          ) : (
            !result.applied && (
              <button
                type="button"
                disabled={loading || !parsed}
                onClick={() => parsed && window.confirm("미리보기 내용대로 적용할까요?") && call(parsed, true)}
                className="mt-5 h-12 rounded-lg bg-navy px-8 font-bold text-white hover:bg-navy-700 disabled:bg-sub"
              >
                적용하기
              </button>
            )
          )}
        </section>
      )}
    </div>
  );
}