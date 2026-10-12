"use client";

import { formatPhone } from "@/lib/phone";

type Props = Omit<React.InputHTMLAttributes<HTMLInputElement>, "value" | "onChange"> & {
  value: string;
  onChange: (value: string) => void;
};

/** 휴대폰 번호 입력 — 항상 010-xxxx-xxxx 자동 하이픈 */
export default function PhoneInput({ value, onChange, className = "", ...rest }: Props) {
  return (
    <input
      type="tel"
      inputMode="numeric"
      autoComplete="tel"
      placeholder="010-0000-0000"
      maxLength={13}
      value={value}
      onChange={(e) => onChange(formatPhone(e.target.value))}
      className={className}
      {...rest}
    />
  );
}
