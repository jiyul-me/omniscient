// 검색칸 글자의 빠른 모양 검사 (첫 화면·머리말·오류 화면 검색칸 공용). 체크섬·ENS 확인은 서버(lib/address.ts)에서
const LOOKS_VALID = /^(0x[0-9a-fA-F]{40}|[^\s/]+\.eth)$/i;

// 문제가 있으면 안내 문장, 괜찮으면 null
export function queryProblem(value: string) {
  if (!value) return "지갑 주소나 ENS 이름(.eth)을 넣어 주세요.";
  if (!LOOKS_VALID.test(value)) return "0x로 시작하는 42글자 주소나 .eth 이름을 넣어 주세요.";
  return null;
}

export const traceHref = (value: string) => `/trace/${encodeURIComponent(value)}`;
