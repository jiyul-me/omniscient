import type { ReactNode, SVGProps } from "react";

// 16px 선 아이콘 (선 굵기 1.5, 글자색 currentColor). ← ↗ ⚠ 같은 글자는 글꼴마다 모양·굵기가 달라서 대신 씀
// 아이콘만 있는 링크·버튼엔 aria-label 필수. 크기는 className(size-3.5 / size-4 / size-5)으로
type IconProps = Omit<SVGProps<SVGSVGElement>, "children">;

function Icon({
  className = "size-4",
  children,
  ...props
}: IconProps & { children: ReactNode }) {
  return (
    <svg
      width={16}
      height={16}
      viewBox="0 0 16 16"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.5}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      focusable="false"
      className={`shrink-0 ${className}`}
      {...props}
    >
      {children}
    </svg>
  );
}

export function ArrowLeftIcon(props: IconProps) {
  return <Icon {...props}><path d="M13 8H3M7 4 3 8l4 4" /></Icon>;
}

// 보냄 (밖으로 나감)
export function ArrowUpRightIcon(props: IconProps) {
  return <Icon {...props}><path d="M5 11 11 5M6 5h5v5" /></Icon>;
}

// 받음 (안으로 들어옴)
export function ArrowDownLeftIcon(props: IconProps) {
  return <Icon {...props}><path d="M11 5 5 11M10 11H5V6" /></Icon>;
}

// 자기 자신에게 보냄 · 다시 시도
export function RefreshIcon(props: IconProps) {
  return (
    <Icon {...props}>
      <path d="M14 8a6 6 0 1 1-1.76-4.24L14 5.5" />
      <path d="M14 2.5v3h-3" />
    </Icon>
  );
}

// 새 탭으로 열리는 바깥 링크 (보냄 화살표와 헷갈리지 않게 상자 모양)
export function ExternalIcon(props: IconProps) {
  return (
    <Icon {...props}>
      <path d="M9.5 2.5h4v4M13.5 2.5 8 8M12 9.5v3a1 1 0 0 1-1 1H3.5a1 1 0 0 1-1-1V5a1 1 0 0 1 1-1h3" />
    </Icon>
  );
}

export function ChevronRightIcon(props: IconProps) {
  return (
    <Icon {...props}>
      <path d="m6 3.5 4.5 4.5L6 12.5" />
    </Icon>
  );
}

export function InfoIcon(props: IconProps) {
  return (
    <Icon {...props}>
      <circle cx="8" cy="8" r="6" />
      <path d="M8 7.5V11M8 5h.01" />
    </Icon>
  );
}

export function AlertIcon(props: IconProps) {
  return (
    <Icon {...props}>
      <path d="M7.13 2.5a1 1 0 0 1 1.74 0l5.2 9a1 1 0 0 1-.87 1.5H2.8a1 1 0 0 1-.87-1.5Z" />
      <path d="M8 6v3M8 11h.01" />
    </Icon>
  );
}

export function SearchIcon(props: IconProps) {
  return (
    <Icon {...props}>
      <circle cx="7" cy="7" r="4.5" />
      <path d="m10.5 10.5 3 3" />
    </Icon>
  );
}

// 시간 슬라이더 재생·멈춤
export function PlayIcon(props: IconProps) {
  return (
    <Icon {...props}>
      <path d="M5 3.5v9l7-4.5Z" />
    </Icon>
  );
}

export function PauseIcon(props: IconProps) {
  return (
    <Icon {...props}>
      <path d="M5.5 3.5v9M10.5 3.5v9" />
    </Icon>
  );
}

// 그래프 확대·축소·화면 맞춤
export function PlusIcon(props: IconProps) {
  return (
    <Icon {...props}>
      <path d="M8 3.5v9M3.5 8h9" />
    </Icon>
  );
}

export function MinusIcon(props: IconProps) {
  return (
    <Icon {...props}>
      <path d="M3.5 8h9" />
    </Icon>
  );
}

export function FitIcon(props: IconProps) {
  return (
    <Icon {...props}>
      <path d="M2.5 6V2.5H6M10 2.5h3.5V6M13.5 10v3.5H10M6 13.5H2.5V10" />
    </Icon>
  );
}

// 3D 화면 닫기
export function CloseIcon(props: IconProps) {
  return (
    <Icon {...props}>
      <path d="m4 4 8 8M12 4l-8 8" />
    </Icon>
  );
}

// PDF로 저장 (인쇄)
export function PrinterIcon(props: IconProps) {
  return (
    <Icon {...props}>
      <path d="M4.5 6V2.5h7V6M4.5 11.5h-1a1 1 0 0 1-1-1V7a1 1 0 0 1 1-1h9a1 1 0 0 1 1 1v3.5a1 1 0 0 1-1 1h-1" />
      <path d="M4.5 9.5h7v4h-7Z" />
    </Icon>
  );
}

export function ArrowRightIcon(props: IconProps) {
  return <Icon {...props}><path d="M3 8h10M9 4l4 4-4 4" /></Icon>;
}

// 주소 복사
export function CopyIcon(props: IconProps) {
  return (
    <Icon {...props}>
      <path d="M5.5 5.5V3.5a1 1 0 0 1 1-1h6a1 1 0 0 1 1 1v6a1 1 0 0 1-1 1h-2" />
      <path d="M3.5 5.5h6a1 1 0 0 1 1 1v6a1 1 0 0 1-1 1h-6a1 1 0 0 1-1-1v-6a1 1 0 0 1 1-1Z" />
    </Icon>
  );
}

// 복사 완료
export function CheckIcon(props: IconProps) {
  return <Icon {...props}><path d="m3.5 8.5 3 3 6-7" /></Icon>;
}

// 최소 점수 규칙 (점수가 이 아래로 안 내려감)
export function LockIcon(props: IconProps) {
  return (
    <Icon {...props}>
      <path d="M4 7.5h8a.5.5 0 0 1 .5.5v5a.5.5 0 0 1-.5.5H4a.5.5 0 0 1-.5-.5V8a.5.5 0 0 1 .5-.5Z" />
      <path d="M5.5 7.5V5a2.5 2.5 0 0 1 5 0v2.5" />
    </Icon>
  );
}

// 정렬 바꾸기
export function SortIcon(props: IconProps) {
  return <Icon {...props}><path d="M5 3v10M2.5 10.5 5 13l2.5-2.5M11 13V3M8.5 5.5 11 3l2.5 2.5" /></Icon>;
}
