"use client";

import { useEffect, useRef, useState } from "react";
import { Upload, X } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { createImageUpload } from "@/lib/admin/upload";

export default function ImageUploadField({
  name,
  label,
  folder,
  defaultValue = "",
  required = false,
  hint,
}: {
  name: string;
  label: string;
  folder: "banners" | "popups" | "products";
  defaultValue?: string;
  required?: boolean;
  hint?: string;
}) {
  const [url, setUrl] = useState(defaultValue);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const fileRef = useRef<HTMLInputElement>(null);
  const textRef = useRef<HTMLInputElement>(null);

  // 저장 후 폼이 초기화될 때 이미지 칸도 함께 초기화
  useEffect(() => {
    const form = textRef.current?.form;
    if (!form) return;
    const onReset = () => {
      setUrl(defaultValue);
      setError("");
    };
    form.addEventListener("reset", onReset);
    return () => form.removeEventListener("reset", onReset);
  }, [defaultValue]);

  // 저장된 값이 바뀌면(수정 저장 후) 화면 값도 맞춤
  useEffect(() => {
    setUrl(defaultValue);
  }, [defaultValue]);

  const onFile = async (file: File) => {
    setError("");
    setBusy(true);
    try {
      const ticket = await createImageUpload(folder, file.type, file.size);
      if (!ticket.ok) {
        setError(ticket.error);
        return;
      }
      const { error: upErr } = await createClient()
        .storage.from("site")
        .uploadToSignedUrl(ticket.path, ticket.token, file, { contentType: file.type });
      if (upErr) {
        setError("업로드에 실패했습니다. 다시 시도해주세요.");
        return;
      }
      setUrl(ticket.publicUrl);
    } catch {
      setError("업로드 중 오류가 발생했습니다.");
    } finally {
      setBusy(false);
    }
  };

  const input = "h-10 w-full rounded-lg border border-line px-3 text-sm outline-none focus:border-navy";

  return (
    <div className="text-[13px] font-semibold">
      <span>
        {label}
        {required && <span className="ml-0.5 text-coral">*</span>}
        {hint && <span className="ml-1 font-normal text-sub">{hint}</span>}
      </span>
      <div className="mt-1 flex gap-2">
        <input
          ref={textRef}
          name={name}
          value={url}
          onChange={(e) => setUrl(e.target.value)}
          placeholder="파일을 올리거나 https:// 주소 입력"
          required={required}
          className={input}
        />
        <button
          type="button"
          onClick={() => fileRef.current?.click()}
          disabled={busy}
          className="flex h-10 shrink-0 items-center gap-1.5 rounded-lg border border-navy px-3 text-sm font-bold text-navy hover:bg-navy/5 disabled:opacity-50"
        >
          <Upload size={15} /> {busy ? "올리는 중..." : "파일 올리기"}
        </button>
        {url && (
          <button
            type="button"
            onClick={() => {
              setUrl("");
              setError("");
            }}
            aria-label="이미지 지우기"
            className="flex h-10 shrink-0 items-center gap-1 rounded-lg border border-line px-3 text-sm font-semibold text-sub hover:border-coral hover:text-coral"
          >
            <X size={15} /> 지우기
          </button>
        )}
        <input
          ref={fileRef}
          type="file"
          accept="image/jpeg,image/png,image/webp"
          className="hidden"
          onChange={(e) => {
            const f = e.target.files?.[0];
            if (f) onFile(f);
            e.target.value = "";
          }}
        />
      </div>
      {error && <p className="mt-1 text-xs font-semibold text-coral">{error}</p>}
      {url && (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={url} alt="" className="mt-2 max-h-36 rounded-lg border border-line object-contain" />
      )}
    </div>
  );
}