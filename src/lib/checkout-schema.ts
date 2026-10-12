import { z } from "zod";
import { phoneSchema } from "@/lib/phone";

export const installationSchema = z.object({
  wishDate: z.union([z.string().regex(/^\d{4}-\d{2}-\d{2}$/), z.literal("")]),
  elevator: z.enum(["yes", "no", "unknown"]),
  floor: z.string().trim().max(10),
  pickupOld: z.boolean(),
  environment: z.string().trim().max(200),
  memo: z.string().trim().max(300),
});

export const checkoutSchema = z.object({
  buyerName: z.string().trim().min(1, "주문자 이름을 입력해주세요.").max(30),
  buyerPhone: phoneSchema,
  buyerEmail: z.union([z.string().trim().email("이메일 형식을 확인해주세요.").max(100), z.literal("")]),
  recipientName: z.string().trim().min(1, "수령인 이름을 입력해주세요.").max(30),
  recipientPhone: phoneSchema,
  zipcode: z.string().trim().regex(/^\d{5}$/, "주소 검색으로 우편번호를 입력해주세요."),
  address1: z.string().trim().min(1, "주소를 검색해주세요.").max(200),
  address2: z.string().trim().max(100),
  deliveryMemo: z.string().trim().max(200),
  installation: installationSchema.optional(),
  agreePrivacy: z.literal(true, { message: "개인정보 수집·이용에 동의해주세요." }),
  agreeOrder: z.literal(true, { message: "주문 내용 및 결제 조건을 확인해주세요." }),
});

export type CheckoutForm = z.infer<typeof checkoutSchema>;

export const orderRequestSchema = z.object({
  campaignSlug: z.string().min(1).max(200),
  selection: z.string().min(1).max(8000),
  idempotencyKey: z.string().uuid(),
  expectedTotal: z.number().int().nonnegative(),
  form: checkoutSchema,
});

/** 설치 정보가 필요 없는 제품군 */
const NO_INSTALL_TYPES = ["무선청소기", "청소기", "로봇청소기", "공기청정기", "제습기"];
export function needsInstallation(productTypes: string[]) {
  return productTypes.some((t) => !NO_INSTALL_TYPES.includes(t));
}