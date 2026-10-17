// 브라우저에서도 쓰는 파일이라 viem 같은 무거운 의존성 금지

// 앞뒤 4글자만 보이면 주소 오염용 '닮은 주소'와 구분이 안 돼서, 표에서는 8글자씩
export function shortAddress(address: string, head = 4, tail = 4) {
  return `${address.slice(0, 2 + head)}…${address.slice(-tail)}`;
}

// formatUnits 결과("10000.123456789…")를 화면용으로: 천 단위 쉼표 + 소수 최대 n자리
export function formatAmount(value: string, maxFraction = 6) {
  const [integer, fraction = ""] = value.split(".");
  const grouped = BigInt(integer).toLocaleString("en-US");
  const trimmed = fraction.slice(0, maxFraction).replace(/0+$/, "");
  if (integer === "0" && !trimmed && /[1-9]/.test(fraction)) {
    return `<0.${"0".repeat(maxFraction - 1)}1`;
  }
  return trimmed ? `${grouped}.${trimmed}` : grouped;
}

const KST = new Intl.DateTimeFormat("sv-SE", {
  timeZone: "Asia/Seoul",
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
  hour: "2-digit",
  minute: "2-digit",
  hour12: false,
});

// "2025-02-21 23:16" (한국 시간)
export function formatKst(iso: string) {
  return KST.format(new Date(iso));
}

// ETH 환산 금액: 100 ETH 이상은 정수, 그보다 작으면 소수 4자리까지 (예: "10,000 ETH", "0.0123 ETH")
export function formatEth(value: number) {
  return `${formatAmount(value.toFixed(4), value >= 100 ? 0 : 4)} ETH`;
}

// 요약 숫자용 ETH 금액: 1 이상은 소수 둘째 자리 고정(182,267.92), 1 미만은 유효숫자 4개(0.004213)
// value = formatUnits 결과 같은 10진수 글자 (BigInt로 반올림해서 소수 오차 없음)
export function formatEthSummary(value: string) {
  const [integer, fraction = ""] = value.split(".");
  if (integer !== "0") {
    const cents = BigInt(integer + (fraction + "00").slice(0, 2)) + (Number(fraction[2] ?? "0") >= 5 ? 1n : 0n);
    const whole = (cents / 100n).toLocaleString("en-US");
    return `${whole}.${String(cents % 100n).padStart(2, "0")}`;
  }
  const first = fraction.search(/[1-9]/);
  if (first === -1) return "0";
  return formatAmount(value, Math.min(first + 4, 18));
}

// 주소를 4글자씩 묶음: "0x" + 10묶음 (화면 표시용, 복사하면 원래 주소 그대로 나오게 components/Address.tsx가 씀)
export function addressGroups(address: string) {
  const body = address.slice(2);
  return Array.from({ length: Math.ceil(body.length / 4) }, (_, i) => body.slice(i * 4, i * 4 + 4));
}

// 비율(0~1) → "20%", "99.7%", "4.4%", "0.1% 미만" (100%에 가깝거나 10% 미만이면 소수 1자리)
export function formatPercent(share: number) {
  const percent = share * 100;
  if (percent > 0 && percent < 0.1) return "0.1% 미만";
  const digits = percent < 10 || (percent > 99 && percent < 100) ? 1 : 0;
  return `${Number(percent.toFixed(digits))}%`;
}
