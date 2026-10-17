import { addressGroups } from "@/lib/format";

// 주소를 4글자씩 끊어서 보여줌. 글자 사이에 공백을 넣지 않고 여백(span margin)만 줘서 복사하면 원래 주소 그대로
// 앞뒤 4글자는 진하게 (지갑·Etherscan 화면과 앞뒤를 비교하기 쉽게). 닮은 주소(lookalike)면 앞뒤에 호박색 밑줄
// variant: full = 10묶음 / short = 앞 2묶음 … 뒤 2묶음 / lines = 5묶음씩 두 줄
export default function Address({
  address,
  variant = "full",
  lookalike = false,
  className = "",
}: {
  address: string;
  variant?: "full" | "short" | "lines";
  lookalike?: boolean;
  className?: string;
}) {
  const groups = addressGroups(address);
  const last = groups.length - 1;
  const mark = lookalike ? "underline decoration-warn-fill decoration-2 underline-offset-4" : "";
  const group = (text: string, index: number) => (
    <span
      key={index}
      className={`${index === 0 || index === last ? `font-semibold text-fg ${mark}` : ""} ${index === last ? "" : "mr-[0.42ch]"}`}
    >
      {text}
    </span>
  );
  if (variant === "short") {
    return (
      <span className={`font-mono whitespace-nowrap ${className}`} aria-label={address}>
        <span className="text-muted">0x</span>
        {group(groups[0], 0)}
        <span className="mr-[0.42ch]">{groups[1]}</span>
        <span className="mr-[0.42ch] text-muted">…</span>
        <span className="mr-[0.42ch]">{groups[last - 1]}</span>
        {group(groups[last], last)}
      </span>
    );
  }
  return (
    <span className={`font-mono ${className}`}>
      <span className="text-muted">0x</span>
      {variant === "lines" ? (
        <>
          {groups.slice(0, 5).map((text, i) => group(text, i))}
          <br />
          {groups.slice(5).map((text, i) => group(text, i + 5))}
        </>
      ) : (
        groups.map(group)
      )}
    </span>
  );
}
