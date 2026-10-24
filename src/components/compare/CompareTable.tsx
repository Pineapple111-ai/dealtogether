export type CompareColumn = { key: string; header: React.ReactNode };
export type CompareRow = { label: string; cells: React.ReactNode[] };

export default function CompareTable({ columns, rows }: { columns: CompareColumn[]; rows: CompareRow[] }) {
  return (
    <div className="overflow-x-auto rounded-xl border border-line">
      <table className="w-full min-w-[640px] table-fixed text-sm">
        <colgroup>
          <col className="w-28 md:w-40" />
          {columns.map((c) => <col key={c.key} />)}
        </colgroup>
        <thead>
          <tr className="border-b border-line align-top">
            <th className="sticky left-0 z-10 bg-white p-3" />
            {columns.map((c) => (
              <th key={c.key} className="p-3 text-left font-normal">{c.header}</th>
            ))}
          </tr>
        </thead>
        <tbody className="divide-y divide-line">
          {rows.map((r) => (
            <tr key={r.label} className="align-top">
              <th className="sticky left-0 z-10 bg-soft p-3 text-left text-[13px] font-semibold text-sub">{r.label}</th>
              {r.cells.map((cell, i) => (
                <td key={i} className="tabular p-3 leading-relaxed">{cell}</td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}