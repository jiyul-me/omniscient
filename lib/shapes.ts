// 분류마다 모양도 다르게 (색만으로 구분하면 색약인 사람은 빨강·초록을 헷갈림)
// 그래프 캔버스(FlowGraph)·범례·배지·표가 같이 씀 → 브라우저에서도 쓰는 파일이라 무거운 의존성 금지

export type Shape = "circle" | "square" | "diamond" | "triangle" | "triangle-down" | "hexagon";

// 모름·해킹 피해 = 원, 제재 = 네모, 해커 = 마름모, 믹서 = 세모, 브릿지 = 거꾸로 세모, 거래소·DEX = 육각형
export function shapeOf(category: string | null | undefined): Shape {
  switch (category) {
    case "sanctioned":
      return "square";
    case "hacker":
      return "diamond";
    case "mixer":
      return "triangle";
    case "bridge":
      return "triangle-down";
    case "exchange":
    case "dex":
      return "hexagon";
    default:
      return "circle";
  }
}

const round = (value: number) => Math.round(value * 100) / 100;

// (x, y) 가운데, 반지름 r인 원과 넓이가 비슷한 도형의 SVG 경로 → <path d>와 캔버스 Path2D에 같이 씀
export function shapePath(shape: Shape, x: number, y: number, r: number): string {
  const points = (list: [number, number][]) =>
    `M${list.map(([px, py]) => `${round(px)} ${round(py)}`).join("L")}Z`;
  switch (shape) {
    case "square": {
      const half = r * 0.9; // 넓이가 원과 비슷하게 (한 변 1.8r)
      return points([
        [x - half, y - half],
        [x + half, y - half],
        [x + half, y + half],
        [x - half, y + half],
      ]);
    }
    case "diamond": {
      const k = r * 1.25;
      return points([
        [x, y - k],
        [x + k, y],
        [x, y + k],
        [x - k, y],
      ]);
    }
    case "triangle":
    case "triangle-down": {
      const side = r * 2.69; // 정삼각형 넓이 = 원과 같게
      const height = side * 0.866;
      const flip = shape === "triangle" ? 1 : -1;
      // 무게중심보다 조금 아래(거꾸로 세모는 위)에 두면 눈으로 볼 때 가운데에 있어 보임
      const cy = y + flip * r * 0.2;
      return points([
        [x, cy - (flip * height * 2) / 3],
        [x + side / 2, cy + (flip * height) / 3],
        [x - side / 2, cy + (flip * height) / 3],
      ]);
    }
    case "hexagon": {
      const s = r * 1.1;
      return points(
        Array.from({ length: 6 }, (_, i) => {
          // 윗변이 평평하게 (작게 그려도 원과 헷갈리지 않게)
          const angle = (Math.PI / 3) * i;
          return [x + s * Math.cos(angle), y + s * Math.sin(angle)] as [number, number];
        }),
      );
    }
    default:
      return `M${round(x - r)} ${round(y)}a${round(r)} ${round(r)} 0 1 0 ${round(r * 2)} 0a${round(r)} ${round(r)} 0 1 0 ${round(-r * 2)} 0Z`;
  }
}
