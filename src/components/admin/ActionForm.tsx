"use client";

import { useActionState } from "react";
import { useFormStatus } from "react-dom";
import type { ActionResult } from "@/lib/admin/action-result";

export function SubmitButton({ children, className = "" }: { children: React.ReactNode; className?: string }) {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      disabled={pending}
      className={`h-10 rounded-lg bg-navy px-4 text-sm font-bold text-white hover:bg-navy-700 disabled:bg-sub ${className}`}
    >
      {pending ? "저장 중..." : children}
    </button>
  );
}

/** 서버 액션 폼: 실패 메시지/성공 메시지 표시 */
export default function ActionForm({
  action,
  children,
  className = "",
}: {
  action: (fd: FormData) => Promise<ActionResult>;
  children: React.ReactNode;
  className?: string;
}) {
  const [state, formAction] = useActionState(
    async (_prev: ActionResult | null, fd: FormData) => action(fd),
    null
  );

  return (
    <form action={formAction} className={className}>
      {children}
      {state && !state.ok && (
        <p className="basis-full text-sm font-semibold text-coral" role="alert">{state.error}</p>
      )}
      {state?.ok && state.message && (
        <p className="basis-full text-sm font-semibold text-navy">{state.message}</p>
      )}
    </form>
  );
}