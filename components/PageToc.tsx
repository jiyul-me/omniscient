"use client";

import { useEffect, useState } from "react";

// 긴 페이지 오른쪽에 따라오는 목차. 지금 읽는 단원은 진하게 + 왼쪽 줄 (자료 출처·계산법 페이지)
export default function PageToc({ items }: { items: readonly { id: string; label: string }[] }) {
  const [active, setActive] = useState<string | null>(null);
  useEffect(() => {
    const visible = new Map<string, boolean>();
    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) visible.set(entry.target.id, entry.isIntersecting);
        setActive(items.find((item) => visible.get(item.id))?.id ?? null);
      },
      { rootMargin: "0px 0px -70% 0px" },
    );
    for (const item of items) {
      const element = document.getElementById(item.id);
      if (element) observer.observe(element);
    }
    return () => observer.disconnect();
  }, [items]);

  return (
    <nav aria-label="이 페이지" className="sticky top-8">
      <p className="text-xs font-semibold text-muted">이 페이지</p>
      <ul className="mt-3 space-y-0.5 border-l border-line">
        {items.map((item) => (
          <li key={item.id}>
            <a
              href={`#${item.id}`}
              aria-current={active === item.id ? "location" : undefined}
              className={`focus-ring -ml-px block border-l-2 py-1 pl-3 text-sm transition-colors ${
                active === item.id ? "border-fg font-semibold text-fg" : "border-transparent text-fg-2 hover:text-fg"
              }`}
            >
              {item.label}
            </a>
          </li>
        ))}
      </ul>
    </nav>
  );
}
