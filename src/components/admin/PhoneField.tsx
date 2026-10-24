"use client";

import { useState } from "react";
import PhoneInput from "@/components/form/PhoneInput";

export default function PhoneField({ name, defaultValue = "", className = "" }: { name: string; defaultValue?: string; className?: string }) {
  const [v, setV] = useState(defaultValue);
  return <PhoneInput name={name} value={v} onChange={setV} className={className} />;
}