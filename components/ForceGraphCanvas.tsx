"use client";

import { useEffect, type RefObject } from "react";
import ForceGraph2D, {
  type ForceGraphMethods,
  type ForceGraphProps,
} from "react-force-graph-2d";

// react-force-graph는 브라우저 전용이라 FlowGraph에서 next/dynamic(ssr: false)으로 이 파일을 불러옴.
// dynamic으로 감싸면 ref를 바로 넘기기 어려워서 graphRef로 받아 그대로 꽂아 줌
export type GraphMethods = ForceGraphMethods;

type Props = ForceGraphProps & {
  graphRef: RefObject<GraphMethods | undefined>;
  onReady?: (methods: GraphMethods) => void;
};

export default function ForceGraphCanvas({ graphRef, onReady, ...props }: Props) {
  useEffect(() => {
    if (graphRef.current) onReady?.(graphRef.current);
    // 처음 한 번만 (힘 설정)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <ForceGraph2D
      ref={graphRef as React.MutableRefObject<GraphMethods | undefined>}
      {...props}
    />
  );
}
