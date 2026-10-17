"use client";

import { useSyncExternalStore } from "react";

// 화면 조건(CSS 미디어 쿼리)이 맞는지. 서버 렌더에서는 false
export function useMedia(query: string) {
  return useSyncExternalStore(
    (notify) => {
      const list = window.matchMedia(query);
      list.addEventListener("change", notify);
      return () => list.removeEventListener("change", notify);
    },
    () => window.matchMedia(query).matches,
    () => false,
  );
}

// '동작 줄이기' 설정이면 빛 알갱이·카메라 이동 애니메이션을 끔
export const useReducedMotion = () => useMedia("(prefers-reduced-motion: reduce)");
// 손가락으로 쓰는 기기 (휴대폰·태블릿): 한 손가락은 페이지 스크롤, 두 손가락만 그래프
export const useCoarsePointer = () => useMedia("(pointer: coarse)");
// 손가락으로도 누를 수 있는 기기 (터치 화면 노트북 포함): 점 끌기를 끔
export const useAnyCoarsePointer = () => useMedia("(any-pointer: coarse)");
