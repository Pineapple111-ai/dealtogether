import { NextResponse } from "next/server";
import { z } from "zod";
import { createAdminClient } from "@/lib/supabase/admin";
import { phoneSchema } from "@/lib/phone";
import { phoneToAuthEmail, PASSWORD_RULE, PASSWORD_MESSAGE } from "@/lib/auth/phone-login";

const schema = z.object({
  name: z.string().trim().min(1, "이름을 입력해주세요.").max(30),
  phone: phoneSchema,
  password: z.string().regex(PASSWORD_RULE, PASSWORD_MESSAGE),
  agreeTerms: z.literal(true, { message: "이용약관에 동의해주세요." }),
  agreePrivacy: z.literal(true, { message: "개인정보 수집·이용에 동의해주세요." }),
  marketing: z.boolean(),
});

const DUPLICATE = "이미 가입된 휴대폰 번호입니다. 로그인해주세요.";

export async function POST(req: Request) {
  const parsed = schema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ message: parsed.error.issues[0]?.message ?? "입력값을 확인해주세요." }, { status: 400 });
  }
  const b = parsed.data;
  const db = createAdminClient();

  // 이미 같은 번호로 가입한 회원이 있는지
  const { data: exists } = await db.from("profiles").select("id").eq("phone", b.phone).maybeSingle();
  if (exists) return NextResponse.json({ message: DUPLICATE }, { status: 409 });

  const { error } = await db.auth.admin.createUser({
    email: phoneToAuthEmail(b.phone),
    password: b.password,
    email_confirm: true,
    user_metadata: { name: b.name, phone: b.phone, marketing_agreed: b.marketing },
  });

  if (error) {
    const msg = error.message.toLowerCase();
    if (msg.includes("already") || msg.includes("registered") || msg.includes("duplicate")) {
      return NextResponse.json({ message: DUPLICATE }, { status: 409 });
    }
    console.error("회원가입 실패", error);
    return NextResponse.json({ message: "회원가입 중 오류가 발생했습니다." }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}