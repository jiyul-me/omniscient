// 그래프 점 색깔 = 주소의 정체. 라벨이 겹칠 때의 우선순위 순서
// 색은 밝은 종이·흰 판에서 3:1 이상 (2026-10-17 밝은 리포트 디자인). 색약이면 모양(lib/shapes.ts)으로 구분
export const CATEGORY_ORDER = [
  "sanctioned",
  "hacker",
  "mixer",
  "bridge",
  "exchange",
  "unknown",
] as const;

export type Category = (typeof CATEGORY_ORDER)[number];

export const CATEGORY_STYLE: Record<
  Category,
  { name: string; color: string; description: string }
> = {
  sanctioned: {
    name: "제재",
    color: "#dc2626",
    description: "미국 재무부(OFAC) 제재 목록에 오른 주소",
  },
  hacker: {
    name: "해커",
    color: "#0a0a0a",
    description: "FBI 같은 공공기관이나 공개 조사 자료에 나온 해킹 관련 주소",
  },
  mixer: {
    name: "믹서",
    color: "#9333ea",
    description: "여러 사람의 돈을 섞어 출처를 숨기는 서비스 (Tornado Cash 등)",
  },
  bridge: {
    name: "브릿지",
    color: "#2563eb",
    description: "돈을 다른 블록체인으로 옮기는 출구 (THORChain 등)",
  },
  exchange: {
    name: "거래소",
    color: "#15803d",
    description: "코인 거래소와 DEX(회사 없이 돌아가는 코인 교환 서비스)",
  },
  unknown: {
    name: "모름",
    color: "#7c828c",
    description: "아직 라벨이 없는 주소",
  },
};

// 범례에 쓰는 이름: 초록 점은 거래소와 DEX를 같이 뜻함 (첫 화면·그래프 범례·자료 출처 페이지 공용)
export function legendName(category: Category) {
  return category === "exchange" ? "거래소·DEX" : CATEGORY_STYLE[category].name;
}

// data/labels.json의 분류. DEX는 거래소 색(초록)으로, 해킹 피해 지갑은 회색으로 칠하되 이름은 따로
export type LabelCategory =
  | "sanctioned"
  | "hacker"
  | "mixer"
  | "bridge"
  | "exchange"
  | "dex"
  | "victim";

// 돈이 다른 돈과 섞여서 더 따라갈 수 없는 곳 = 그래프 종착역 (브레이크 ④)
export const TERMINAL_CATEGORIES: readonly LabelCategory[] = ["exchange", "dex", "bridge", "mixer"];

export function labelStyle(category: LabelCategory | null | undefined) {
  if (!category || category === "victim") {
    return {
      ...CATEGORY_STYLE.unknown,
      name: category === "victim" ? "해킹 피해 지갑" : CATEGORY_STYLE.unknown.name,
    };
  }
  if (category === "dex") return { ...CATEGORY_STYLE.exchange, name: "DEX" };
  return CATEGORY_STYLE[category];
}

// 결과 화면 머리말의 분류 설명 한 문장 (해요체)
export const CATEGORY_SENTENCE: Record<LabelCategory, string> = {
  sanctioned: "미국 재무부(OFAC) 제재 목록에 오른 주소예요.",
  hacker: "공공기관이나 공개 조사 자료에 해킹 관련으로 나온 주소예요.",
  mixer: "여러 사람의 돈을 섞어 출처를 숨기는 서비스예요.",
  bridge: "돈을 다른 블록체인으로 옮기는 출구예요.",
  exchange: "코인 거래소가 쓰는 주소예요.",
  dex: "회사 없이 돌아가는 코인 교환 서비스(DEX)예요.",
  victim: "해킹으로 돈을 잃은 지갑이에요.",
};
