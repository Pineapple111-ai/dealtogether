export const ORDER_STATUS_LABEL: Record<string, string> = {
  pending_payment: "결제 대기",
  payment_verification: "결제 확인 중",
  paid: "결제 완료",
  preparing: "상품 준비 중",
  shipping: "배송 중",
  delivered: "배송 완료",
  installation_scheduled: "설치 일정 확정",
  completed: "주문 완료",
  cancelled: "주문 취소",
  expired: "결제 기한 만료",
  refunded: "환불 완료",
};

export const PAYMENT_STATUS_LABEL: Record<string, string> = {
  waiting: "결제 대기",
  redirected: "결제 페이지 이동",
  verifying: "결제 확인 중",
  confirmed: "결제 완료",
  failed: "결제 실패",
  cancelled: "결제 취소",
  refunding: "환불 처리 중",
  refunded: "환불 완료",
};

/** 결제 대기 상태이면서 아직 만료 전인지 */
export function isAwaitingPayment(status: string, expiresAt: string, now = Date.now()) {
  return (
    (status === "pending_payment" || status === "payment_verification") &&
    new Date(expiresAt).getTime() > now
  );
}