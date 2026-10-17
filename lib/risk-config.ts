// 그래프 브레이크·먼지 기준과 위험 점수 가중치 (계산법: README '위험 점수')

// 먼지: ETH로 바꿔서 이보다 작은 송금은 그래프에서 빼고, 받은 먼지는 점수에서도 무시 (스팸·주소 오염 방지)
export const DUST_ETH = 0.01;

export const GRAPH = {
  // 한쪽(받은/보낸)마다 보여줄 상대 수. 비슷한 금액 묶음은 1곳으로 셈
  topPerSide: 10, // PLAN 4장 결정 2 ②: 10~15
  // 첫 화면에서 2단계까지 자동으로 펼칠 상대 수 (한쪽마다). 늘리면 Alchemy 호출이 그만큼 늘어남
  autoExpandPerSide: 4,
  // 그쪽 전체 금액에서 이 비율보다 작은 상대는 자동으로 안 펼침 (눌러서는 펼칠 수 있음)
  autoExpandMinShare: 0.01,
  // 점을 눌러 펼칠 때 새로 붙일 상대 수
  expandTop: 6,
  // 이 단계까지만 펼칠 수 있음 (그래프 폭발 방지)
  maxHop: 5,
  // 비슷한 금액(같은 토큰, 유효숫자 3자리 같음) 송금이 이만큼 모이면 묶음
  bundleMin: 5,
  // 묶음이 이보다 크면 점 하나로 접어서 보여주고, 작으면 처음부터 펼쳐서 보여줌 (2026-10-16 결정)
  bundleShowMax: 50,
} as const;

// 위험 점수. 기여도 = W(카테고리 무게) × D(거리 할인) × S(금액 비중)
export const RISK = {
  // W: 얼마나 나쁜 곳? (사기 0.8은 라벨 자료가 생기면 추가)
  weights: {
    sanctioned: 1.0,
    hacker: 0.9,
    mixer: 0.7,
    bridge: 0.1, // 참고용
    exchange: 0, // 거래소·DEX는 중립
    dex: 0,
    victim: 0, // 해킹 피해 지갑은 나쁜 곳이 아님
  },
  // D: 몇 단계 건너? (index = 단계). 결과가 너무 빨갛게 나오면 2단계 0.3, 3단계 0.1로 낮추기
  hopDiscount: [1, 1.0, 0.5, 0.25],
  // 주소 자체가 제재·해커 라벨이거나, 제재 주소로 직접 돈을 보냈으면 최소 이 점수
  floor: 90,
  // 2단계 계산: 라벨 없는 상대 중 금액 큰 몇 곳(비슷한 금액 묶음은 1곳으로 셈)의 기록을 한 번 더 가져와서
  // 그 돈의 출처·사용처를 봄. 한쪽마다 Alchemy 호출이 최대 '이 수 × lookThroughSamples'만큼 늘어남
  // (그래프가 미리 펼친 주소와 겹치면 같은 호출을 같이 씀)
  lookThroughPerSide: 4,
  // 그쪽 전체 금액에서 이 비율보다 작은 상대는 2단계까지 안 봄 (비슷한 금액 묶음은 합계로 비교)
  lookThroughMinShare: 0.01,
  // 비슷한 금액 묶음(같은 토큰·유효숫자 3자리, GRAPH.bundleMin곳 이상)은 금액 큰 몇 곳만 보고 나머지도 같은 비율이라고 봄
  lookThroughSamples: 2,
  // 등급 (업계 4단계 이름을 빌려옴). 위에서부터 처음 맞는 것
  grades: [
    { key: "severe", name: "매우 높음", min: 80 },
    { key: "high", name: "높음", min: 50 },
    { key: "medium", name: "보통", min: 20 },
    { key: "low", name: "낮음", min: 0 },
  ],
  // 이 점수부터 호박색 경고 표시 (2026-10-17 결정)
  warnFrom: 50,
} as const;
