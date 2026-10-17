"use client";

import { useEffect, useSyncExternalStore } from "react";

// 위험 점수는 결과 화면에서 따로 늦게 불러와서(RiskSection), 위에 붙는 띠(StickyCaseBar)가 알 수 있게 여기에 적어 둠
type CaseScore = { score: number; gradeName: string } | null;
let current: CaseScore = null;
const listeners = new Set<() => void>();

function publish(value: CaseScore) {
  current = value;
  listeners.forEach((listener) => listener());
}

export function useCaseScore() {
  return useSyncExternalStore(
    (listener) => {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
    () => current,
    () => null,
  );
}

// 점수 카드가 화면에 있는 동안 점수를 알림 (화면에 아무것도 그리지 않음)
export function ScoreBeacon({ score, gradeName }: { score: number; gradeName: string }) {
  useEffect(() => {
    publish({ score, gradeName });
    return () => publish(null);
  }, [score, gradeName]);
  return null;
}
