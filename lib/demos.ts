// 데모 사례: 공공기관이 공개한 사건의 시작 주소 + 점수가 낮게 나오는 정상 비교 지갑 1곳
// 주소는 화면 표시용 체크섬 형태 (블록체인 기록으로 체크섬 확인). 저장본은 data/demos/<id>.json (npm run demos)
// 브라우저(데모 카드·검색칸)에서도 쓰는 파일이라 fs 같은 서버 전용 기능 금지
export type DemoCase = {
  id: string;
  kind: "hack" | "normal";
  title: string;
  date?: string; // 사건 날짜 (해킹 사례만)
  address: string;
  ens?: string; // 데모 버튼은 이 이름으로 이동 (ENS 이름 입력도 보여주려고)
  note?: string; // 데모 버튼 아래 작은 설명
  story: string; // 데모 카드의 한 줄 이야기
  source?: { name: string; url: string }; // 라벨 목록에 없는 주소의 정체 출처 (정상 비교 지갑)
};

export const DEMO_CASES: readonly DemoCase[] = [
  {
    id: "bybit",
    kind: "hack",
    title: "Bybit 해킹",
    date: "2025-02-21",
    address: "0x47666Fab8bd0Ac7003bce3f5C3585383F09486E2",
    story: "1만 ETH씩 40곳으로 쪼개 보낸 흐름",
  },
  {
    id: "ronin",
    kind: "hack",
    title: "Ronin 해킹",
    date: "2022-03-23",
    address: "0x098B716B8Aaf21512996dC57EB0615e2383E2f96",
    story: "OFAC 제재 주소 · 3,003.3 ETH씩 쪼개기",
  },
  {
    id: "upbit",
    kind: "hack",
    title: "업비트 해킹",
    date: "2019-11-27",
    address: "0xa09871AEadF4994Ca12f5c0b6056BBd1d343c029",
    story: "도난 직후 첫 분산은 세 갈래",
  },
  {
    // 2026-10-17 결정. ENS 공식 문서 EP 6.37에 'wallet.ensdao.eth (Timelock)'로 주소가 공개돼 있음
    id: "ensdao",
    kind: "normal",
    title: "ENS DAO 지갑",
    address: "0xFe89cc7aBB2C4183683ab71653C4cdc9B02D44b7",
    ens: "wallet.ensdao.eth",
    note: "정상 비교",
    story: "ENS 공식 문서에 공개된 단체 지갑",
    source: { name: "ENS 공식 문서 EP 6.37", url: "https://docs.ens.domains/dao/proposals/6.37" },
  },
];

// 검색창·주소창에 넣은 글자가 데모 사례인지 (주소는 대소문자 무시, ENS 이름 포함)
export function findDemo(input: string) {
  const value = input.trim().toLowerCase();
  return (
    DEMO_CASES.find((demo) => demo.address.toLowerCase() === value || demo.ens === value) ?? null
  );
}

export function demoHref(demo: DemoCase) {
  return `/trace/${demo.ens ?? demo.address}`;
}
