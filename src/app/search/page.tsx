import { Suspense } from "react";
import { redirect } from "next/navigation";

type Props = { searchParams: Promise<{ q?: string }> };

export default function SearchPage(props: Props) {
  return (
    <Suspense fallback={null}>
      <Go {...props} />
    </Suspense>
  );
}

async function Go({ searchParams }: Props): Promise<React.ReactNode> {
  const { q } = await searchParams;
  redirect(q ? `/campaigns?q=${encodeURIComponent(q)}` : "/campaigns");
}