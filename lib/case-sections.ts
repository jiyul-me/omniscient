// 결과 화면 단원 (목차·위에 붙는 띠가 같이 씀). 서버·브라우저 둘 다에서 읽어서 'use client' 파일 밖에 둠
export const SECTIONS = [
  { id: "risk", label: "위험 점수" },
  { id: "graph", label: "자금 흐름" },
  { id: "transfers", label: "송금 기록" },
] as const;
