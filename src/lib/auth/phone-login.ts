/** 휴대폰 번호 → 내부 로그인 ID (고객에게는 노출되지 않음) */
export function phoneToAuthEmail(phone: string) {
  const digits = phone.replace(/\D/g, "");
  return `${digits}@phone.dealtogether.kr`;
}

export const PASSWORD_RULE = /^(?=.*[A-Za-z])(?=.*[0-9]).{8,64}$/;
export const PASSWORD_MESSAGE = "비밀번호는 영문과 숫자를 포함해 8자 이상 입력해주세요.";