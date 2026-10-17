// 렌즈(주소) 안의 점 + 왼쪽에서 들어오고 오른쪽으로 나가는 화살표 = '들어온 돈 → 주소 → 나간 돈'
// app/icon.svg와 같은 그림. 색은 글자색(currentColor)
export default function Logo({ className = "" }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 32 32"
      aria-hidden="true"
      className={className}
      fill="none"
      stroke="currentColor"
      strokeWidth="2.4"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <circle cx="16" cy="16" r="7" />
      <circle cx="16" cy="16" r="2.4" fill="currentColor" stroke="none" />
      <path d="M2.5 16h6M6 12.5 9 16l-3 3.5" />
      <path d="M23 16h6.5M26.5 12.5 30 16l-3.5 3.5" />
    </svg>
  );
}
