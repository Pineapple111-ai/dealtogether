import Image from "next/image";
import Link from "next/link";
import { canOptimize } from "@/lib/images";

export type CompareColumn = {
  key: string;
  image: string | null;
  imageRatio: "4/3" | "1/1";
  brand: string;
  brandColor: string;
  name: string;
  href: string;
  remove: React.ReactNode;
};
export type CompareRow = { label: string; cells: React.ReactNode[] };

function Thumb({ c, sizes }: { c: CompareColumn; sizes: string }) {
  return (
    <div className={`relative overflow-hidden rounded-lg bg-soft ${c.imageRatio === "1/1" ? "aspect-square" : "aspect-[4/3]"}`}>
      {c.image && <Image src={c.image} alt="" fill sizes={sizes} className="object-cover" unoptimized={!canOptimize(c.image)} />}
    </div>
  );
}

export default function CompareTable({ columns, rows }: { columns: CompareColumn[]; rows: CompareRow[] }) {
  const grid = { gridTemplateColumns: `repeat(${columns.length}, minmax(0, 1fr))` };

  return (
    <>
      {/* ===== 모바일: 세로형 비교 ===== */}
      <div className="md:hidden">
        <div className="grid gap-3" style={grid}>
          {columns.map((c) => (
            <div key={c.key} className="min-w-0">
              <Thumb c={c} sizes="33vw" />
              <div className="mt-2">{c.remove}</div>
            </div>
          ))}
        </div>

        {/* 스크롤해도 상품 이름이 보이도록 고정 */}
        <div className="sticky top-16 z-10 -mx-4 mt-2 grid gap-3 border-b border-line bg-white/95 px-4 py-2.5 backdrop-blur" style={grid}>
          {columns.map((c) => (
            <div key={c.key} className="min-w-0">
              <p className="text-[11px] font-bold" style={{ color: c.brandColor }}>{c.brand}</p>
              <Link href={c.href} className="line-clamp-2 break-keep text-[13px] font-bold leading-snug">
                {c.name}
              </Link>
            </div>
          ))}
        </div>

        <dl className="divide-y divide-line">
          {rows.map((r) => (
            <div key={r.label} className="py-3.5">
              <dt className="mb-2 rounded bg-soft px-2 py-1 text-xs font-semibold text-sub">{r.label}</dt>
              <dd className="tabular grid gap-3 text-[13px] leading-relaxed" style={grid}>
                {r.cells.map((cell, i) => (
                  <div key={i} className="min-w-0 break-keep">{cell}</div>
                ))}
              </dd>
            </div>
          ))}
        </dl>
      </div>

      {/* ===== PC: 표 ===== */}
      <div className="hidden overflow-x-auto rounded-xl border border-line md:block">
        <table className="w-full table-fixed text-sm">
          <colgroup>
            <col className="w-40" />
            {columns.map((c) => <col key={c.key} />)}
          </colgroup>
          <thead>
            <tr className="border-b border-line align-top">
              <th className="bg-white p-3" />
              {columns.map((c) => (
                <th key={c.key} className="p-3 text-left font-normal">
                  <Thumb c={c} sizes="360px" />
                  <p className="mt-2 text-xs font-bold" style={{ color: c.brandColor }}>{c.brand}</p>
                  <p className="mt-0.5 font-bold leading-snug">{c.name}</p>
                  <div className="mt-2 flex items-center justify-between">
                    <Link href={c.href} className="text-xs font-bold text-navy underline">상세보기</Link>
                    {c.remove}
                  </div>
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-line">
            {rows.map((r) => (
              <tr key={r.label} className="align-top">
                <th className="bg-soft p-3 text-left text-[13px] font-semibold text-sub">{r.label}</th>
                {r.cells.map((cell, i) => (
                  <td key={i} className="tabular p-3 leading-relaxed">{cell}</td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </>
  );
}