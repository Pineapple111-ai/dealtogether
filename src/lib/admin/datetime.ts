/** ISO → datetime-local 입력값 (KST) */
export function toKstInput(iso: string) {
  return new Date(iso)
    .toLocaleString("sv-SE", { timeZone: "Asia/Seoul", hour12: false })
    .replace(" ", "T")
    .slice(0, 16);
}

/** datetime-local 입력값(KST) → ISO. 형식이 틀리면 null */
export function fromKstInput(v: string): string | null {
  if (!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/.test(v)) return null;
  const d = new Date(`${v}:00+09:00`);
  return Number.isNaN(d.getTime()) ? null : d.toISOString();
}