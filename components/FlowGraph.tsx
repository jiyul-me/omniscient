"use client";

import CategoryMark from "@/components/CategoryMark";
import dynamic from "next/dynamic";
import Link from "next/link";
import {
  Component,
  useEffect,
  useMemo,
  useRef,
  useState,
  type KeyboardEvent,
  type ReactNode,
} from "react";
import {
  AlertIcon,
  ArrowLeftIcon,
  ArrowRightIcon,
  CloseIcon,
  ExternalIcon,
  FitIcon,
  MinusIcon,
  PlusIcon,
} from "@/components/icons";
import { TERMINAL_CATEGORIES, labelStyle } from "@/lib/categories";
import { formatEth, formatKst, shortAddress } from "@/lib/format";
import { linkId, type ExpandResult, type FlowSummary, type GraphData, type GraphNode, type NodeState } from "@/lib/graph";
import { GRAPH } from "@/lib/risk-config";
import { shapeOf, shapePath } from "@/lib/shapes";
import { timelineSteps, visibleAt } from "@/lib/timeline";
import type { GraphMethods } from "./ForceGraphCanvas";
import Address from "./Address";
import GraphLegend, { StateLegend } from "./GraphLegend";
import TopFlows from "./graph/TopFlows";
import { buttonClass } from "./ui/button";
import Notes, { type Note } from "./ui/Notes";
import SegmentedControl from "./ui/SegmentedControl";
import type { Graph3DMethods } from "./graph/Graph3D";
import {
  COLOR,
  NAMED_CATEGORIES,
  SHAPE_REACH,
  configureForces,
  endId,
  graphFonts,
  linkTooltip,
  linkWidth,
  particleCount,
  radius,
  sideText,
  sourceParts,
  stateText,
  tagText,
  toMode,
  tooltipHtml,
  type FGLink,
  type FGNode,
  type GraphState,
} from "./graph/shared";
import TimeSlider from "./graph/TimeSlider";
import { useAnyCoarsePointer, useCoarsePointer, useReducedMotion } from "./graph/useMedia";

// react-force-graph는 브라우저 전용 → 'use client' 파일 안에서 ssr: false로 불러옴
const ForceGraphCanvas = dynamic(() => import("./ForceGraphCanvas"), {
  ssr: false,
  loading: () => <p className="p-6 text-sm text-muted">그래프를 준비하는 중이에요…</p>,
});
// 3D는 three.js가 커서 '3D' 버튼을 눌렀을 때만 내려받음
const Graph3D = dynamic(() => import("./graph/Graph3D"), {
  ssr: false,
  loading: () => <p className="p-6 text-sm text-muted">3D 그래프를 불러오는 중이에요…</p>,
});

const EXPAND_FAILED = "불러오지 못했어요. 다시 눌러 주세요.";
// 서버가 보낸 한국어 안내만 그대로 보여주고, 브라우저 오류(영어 'Failed to fetch' 등)는 기본 문구로
class ExpandError extends Error {}

// 휴대폰: 한 손가락으로 쓸면 페이지가 내려가고, 두 손가락이어야 그래프를 옮기고 확대 (지도 앱처럼)
// 마우스로 끄는 건 그대로 (mousedown엔 touches가 없음)
const panFilter = (event: MouseEvent) => {
  const touches = (event as unknown as TouchEvent).touches;
  return !touches || touches.length >= 2;
};
// 마우스 휠: 그냥 굴리면 페이지가 내려가고, Ctrl(맥은 ⌘)을 누른 채 굴리면 확대 (트랙패드 두 손가락 벌리기도 확대)
const wheelFilter = (event: MouseEvent) => event.ctrlKey || event.metaKey;

// WebGL2가 되는 기기인지 (3D 버튼을 처음 누를 때 한 번만 확인)
let webgl2: boolean | null = null;
function canUse3D() {
  if (webgl2 !== null) return webgl2;
  try {
    const gl = document.createElement("canvas").getContext("webgl2", { failIfMajorPerformanceCaveat: true });
    webgl2 = Boolean(gl);
    gl?.getExtension("WEBGL_lose_context")?.loseContext();
  } catch {
    webgl2 = false;
  }
  return webgl2;
}

// 3D를 불러오다 실패하면(파일 못 받음·WebGL 오류) 2D로 돌아감
class Fallback extends Component<{ onError: () => void; children: ReactNode }, { failed: boolean }> {
  state = { failed: false };
  static getDerivedStateFromError() {
    return { failed: true };
  }
  componentDidCatch() {
    this.props.onError();
  }
  render() {
    return this.state.failed ? null : this.props.children;
  }
}

function initGraph(data: GraphData): GraphState {
  return {
    // 시작 주소는 가운데에 고정
    nodes: data.nodes.map((node) => (node.kind === "center" ? { ...node, fx: 0, fy: 0 } : { ...node })),
    links: data.links.map((link) => ({ ...link })),
  };
}

function SourceText({ tag }: { tag: NonNullable<GraphNode["tag"]> }) {
  const { source, date, note } = sourceParts(tag);
  return (
    <>
      {source}
      {date && (
        <>
          {" · "}
          <span className="whitespace-nowrap">{date}</span>
        </>
      )}
      {note}
    </>
  );
}

// 그래프 안내 문장의 앞말 (Notes): 문장 내용으로 고름
function noteLead(note: string) {
  if (note.includes("만 그렸어요")) return "생략";
  if (note.includes("점선 테두리")) return "점선 테두리";
  if (note.includes("멈췄어요")) return "멈춘 곳";
  return undefined;
}

type Mode = "2d" | "3d";
type Point3 = { x: number; y: number; z: number };
type Hint = { text: string; key: number } | null;

const ICON_BUTTON = buttonClass({ variant: "secondary", size: "sm", icon: true, className: "text-fg-2" });

// demoId = 데모 저장본으로 그린 그래프 (점 펼치기도 저장본에서 먼저 찾음)
export default function FlowGraph({
  data,
  demoId,
  topFlows = [],
}: {
  data: GraphData;
  demoId?: string;
  topFlows?: FlowSummary[];
}) {
  const graphRef = useRef<GraphMethods | undefined>(undefined);
  const graph3dRef = useRef<Graph3DMethods | undefined>(undefined);
  const boxRef = useRef<HTMLDivElement>(null);
  const fullRef = useRef<HTMLDivElement>(null);
  const closeRef = useRef<HTMLButtonElement>(null);
  const button3dRef = useRef<HTMLButtonElement>(null);
  const fitPending = useRef(true);
  const visible = useRef(true);
  const [size, setSize] = useState({ width: 0, height: 0 });
  const [fullSize, setFullSize] = useState({ width: 0, height: 0 });
  const [graph, setGraph] = useState(() => initGraph(data));
  // 펼친 뒤 바뀐 상태는 따로 들고 있음 (그래프 라이브러리가 쓰는 점 객체를 건드리지 않으려고)
  const [states, setStates] = useState<Record<string, NodeState>>({});
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [loadingId, setLoadingId] = useState<string | null>(null);
  const [error, setError] = useState("");
  const [mode, setMode] = useState<Mode>("2d");
  const [notice, setNotice] = useState("");
  // 시간 슬라이더 위치는 '몇 번째 칸'이 아니라 시각으로 기억 (점을 펼쳐 칸이 늘어도 보던 시각 그대로)
  const [cutoff, setCutoff] = useState<number | null>(null); // null = 전체
  const [playing, setPlaying] = useState(false);
  const [hint, setHint] = useState<Hint>(null);
  const [keyboard, setKeyboard] = useState(false);
  const reducedMotion = useReducedMotion();
  const coarse = useCoarsePointer();
  // 터치 화면이 달린 노트북처럼 마우스와 손가락을 같이 쓰는 기기도 점 끌기는 끔 (한 손가락 스크롤·두 손가락 확대가 점에 걸리지 않게)
  const anyCoarse = useAnyCoarsePointer();
  // 손가락 기기에서 3D는 모든 손짓을 3D가 가져가서 화면 전체로 띄움 (닫으면 2D로)
  const fullscreen3d = mode === "3d" && coarse;

  // 함수가 렌더마다 새로 만들어지면 그래프가 빛 알갱이를 처음 위치로 다시 만듦 (점을 누를 때마다 튐) → 고정
  const particles = useMemo(
    () => (reducedMotion ? 0 : (link: object) => particleCount(link as FGLink)),
    [reducedMotion],
  );
  // 3D는 빛 알갱이도 하나하나 입체라 무거움 → 줄임 (손가락 기기는 선마다 하나)
  const particles3d = useMemo(
    () => (reducedMotion ? 0 : coarse ? 1 : (link: FGLink) => Math.min(particleCount(link), 2)),
    [reducedMotion, coarse],
  );
  const centerAmounts = `받은 ${formatEth(data.totals.in)} 상당 · 보낸 ${formatEth(data.totals.out)} 상당`;

  // ── 시간 슬라이더: 그 시각까지 생긴 선만 (lib/timeline.ts). 점·선을 지우지 않고 숨겨서 배치가 그대로
  const steps = useMemo(() => timelineSteps(graph.links), [graph.links]);
  const shown = useMemo(
    () => (cutoff === null ? null : visibleAt(graph.links, data.centerId, cutoff)),
    [graph.links, data.centerId, cutoff],
  );
  const isShown = (id: string) => !shown || shown.nodes.has(id);
  const nodeVisibility = useMemo(
    () => (shown ? (node: object) => shown.nodes.has((node as FGNode).id) : true),
    [shown],
  );
  const linkVisibility = useMemo(
    () => (shown ? (link: object) => shown.links.has((link as FGLink).id) : true),
    [shown],
  );

  // 재생: 다음 시각으로 한 칸씩 (한 번 재생이 15초 안팎). 끝까지 가면 전체로
  useEffect(() => {
    if (!playing) return;
    const delay = Math.min(700, Math.max(150, 15000 / Math.max(steps.length, 1)));
    const timer = setInterval(() => {
      setCutoff((at) => {
        const next = steps.find((time) => at === null || time > at);
        if (next === undefined || next >= steps[steps.length - 1]) {
          setPlaying(false);
          return null;
        }
        return next;
      });
    }, delay);
    return () => clearInterval(timer);
  }, [playing, steps]);

  // 재생 중 새로 나타난 선에는 빛 알갱이를 하나 흘려서 "지금 돈이 움직였다"를 보여줌
  const previousShown = useRef<Set<string> | null>(null);
  useEffect(() => {
    const before = previousShown.current;
    previousShown.current = shown?.links ?? null;
    if (!playing || reducedMotion || !shown || !before) return;
    const methods = mode === "3d" ? graph3dRef.current : graphRef.current;
    for (const link of graph.links) {
      if (shown.links.has(link.id) && !before.has(link.id)) methods?.emitParticle(link as never);
    }
  }, [shown, playing, reducedMotion, mode, graph.links]);

  function togglePlay() {
    if (playing) {
      setPlaying(false);
      return;
    }
    // 끝에 있으면 처음부터
    if (cutoff === null && steps.length > 0) setCutoff(steps[0]);
    setPlaying(true);
  }

  // ── 크기·화면 밖 멈춤
  useEffect(() => {
    const box = boxRef.current;
    if (!box) return;
    const observer = new ResizeObserver(([entry]) => {
      const width = Math.floor(entry.contentRect.width);
      // 다른 페이지로 갔다 오면(Next가 이전 페이지를 숨겨 둠) 폭이 0이 됐다가 그래프를 새로 만듦 → 다시 화면 맞춤
      if (width === 0) fitPending.current = true;
      setSize({ width, height: Math.floor(entry.contentRect.height) });
    });
    observer.observe(box);
    return () => observer.disconnect();
  }, []);

  // 화면 밖에서 멈춰 둔 그래프가 바뀌면(크기 변경·펼치기) 캔버스가 지워지거나 옛 그림으로 남음 → 잠깐 다시 돌려서 그림
  // (안 그러면 그래프까지 안 내려 보고 인쇄할 때 PDF에 빈 칸·옛 그림이 나옴)
  function wakeIfHidden() {
    if (visible.current || (mode === "3d" && coarse)) return;
    const methods = mode === "3d" ? graph3dRef.current : graphRef.current;
    if (!methods) return;
    methods.resumeAnimation();
    // 크기만 바뀐 경우엔 배치가 다시 돌지 않아서(onEngineStop 없음) 두 장면 그린 뒤 다시 멈춤
    requestAnimationFrame(() =>
      requestAnimationFrame(() => {
        if (!visible.current && !fitPending.current) methods.pauseAnimation();
      }),
    );
  }
  useEffect(() => {
    wakeIfHidden();
    // 크기가 바뀔 때만
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [size.width, size.height]);

  useEffect(() => {
    const box = fullRef.current;
    if (!fullscreen3d || !box) return;
    const observer = new ResizeObserver(([entry]) => {
      setFullSize({ width: Math.floor(entry.contentRect.width), height: Math.floor(entry.contentRect.height) });
    });
    observer.observe(box);
    // 3D를 화면 전체로 띄운 동안은 뒤 페이지가 스크롤되지 않게
    const overflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    // 키보드 포커스: 열면 '2D로 돌아가기'로, 닫으면 처음 누른 '3D' 버튼으로 돌려놓음
    closeRef.current?.focus();
    const opener = button3dRef.current;
    return () => {
      observer.disconnect();
      document.body.style.overflow = overflow;
      opener?.focus({ preventScroll: true });
    };
  }, [fullscreen3d]);

  // 그래프가 화면 밖에 있으면 그리기를 멈춤 (빛 알갱이가 계속 돌면 휴대폰 배터리·CPU를 씀)
  // 단, 처음 배치·화면 맞춤이 끝나기 전엔 멈추지 않음 (그래프까지 안 내려 보고 인쇄해도 그림이 남게)
  useEffect(() => {
    const box = boxRef.current;
    if (!box) return;
    const observer = new IntersectionObserver(([entry]) => {
      visible.current = entry.isIntersecting;
      const methods = mode === "3d" ? graph3dRef.current : graphRef.current;
      if (!methods || (mode === "3d" && coarse)) return;
      if (entry.isIntersecting) methods.resumeAnimation();
      else if (!fitPending.current) methods.pauseAnimation();
    });
    observer.observe(box);
    return () => observer.disconnect();
  }, [mode, coarse]);

  // 인쇄(PDF로 저장) 직전: 재생은 멈추고, 3D는 화면 맞춤 후 한 장면 바로 그림
  // 2D는 멈춰 있어도 마지막 장면이 캔버스에 남아 있어서 다시 그리지 않음 (멈춘 캔버스를 인쇄 직전에 다시 그리면 PDF에 하얗게 나옴)
  // 처음 배치·맞춤이 끝나기 전이면(fitPending) 아직 움직이는 중이라 맞춤만
  useEffect(() => {
    let savedCamera: { position: Point3; target: Point3 } | null = null;
    const before = () => {
      setPlaying(false);
      if (mode === "3d") {
        const methods = graph3dRef.current;
        if (!methods) return;
        // 3D는 돌려 보던 각도 그대로면 종이에서 한쪽으로 치우치기 쉬워서 화면 맞춤 후 바로 한 장면 그림
        // (돌아가는 중이면 다음 장면을 기다리지 않고 인쇄돼서 직접 그림). 인쇄가 끝나면 보던 각도로 되돌림
        const { x, y, z } = methods.camera().position;
        savedCamera = { position: { x, y, z }, target: { ...controlTarget(methods) } };
        fit3dRef.current(0);
        // 카메라 방향은 조작기(OrbitControls)가 update에서 바꿔서, 그리기 전에 직접 한 번 부름
        (methods.controls() as { update?: () => void }).update?.();
        const renderer = methods.renderer();
        renderer.render(methods.scene(), methods.camera());
        // 브라우저는 3D(WebGL) 캔버스를 인쇄할 때 방금 그린 장면이 아니라 마지막으로 화면에 띄운 장면을 씀
        // → 방금 그린 장면을 바로 이미지로 떠서 인쇄용으로 붙임 (app/globals.css .print-snapshot, 인쇄가 끝나면 뗌)
        const box = boxRef.current;
        if (box) {
          const image = document.createElement("img");
          image.className = "print-snapshot";
          image.alt = "";
          image.src = renderer.domElement.toDataURL("image/png");
          box.append(image);
        }
      } else if (fitPending.current) graphRef.current?.zoomToFit(0, 64);
    };
    const after = () => {
      boxRef.current?.querySelectorAll(".print-snapshot").forEach((image) => image.remove());
      if (mode === "3d" && savedCamera) {
        graph3dRef.current?.cameraPosition(savedCamera.position, savedCamera.target, 0);
        savedCamera = null;
      }
      if (visible.current || fitPending.current || (mode === "3d" && coarse)) return;
      (mode === "3d" ? graph3dRef.current : graphRef.current)?.pauseAnimation();
    };
    window.addEventListener("beforeprint", before);
    window.addEventListener("afterprint", after);
    return () => {
      window.removeEventListener("beforeprint", before);
      window.removeEventListener("afterprint", after);
    };
  }, [mode, coarse]);

  // ── 손가락·휠 안내: 한 손가락으로 그래프를 쓸거나, 그냥 휠을 굴리면 방법을 잠깐 알려 줌
  useEffect(() => {
    const box = boxRef.current;
    if (!box) return;
    let start: { x: number; y: number } | null = null;
    // 페이지를 내리다 그래프를 지날 때마다 뜨면 귀찮아서 30초에 한 번만
    let lastShown = -Infinity;
    const show = (text: string) => {
      const now = performance.now();
      if (now - lastShown < 30_000) return;
      lastShown = now;
      setHint({ text, key: now });
    };
    const onStart = (event: TouchEvent) => {
      if (mode === "3d") return;
      start = event.touches.length === 1 ? { x: event.touches[0].clientX, y: event.touches[0].clientY } : null;
    };
    const onMove = (event: TouchEvent) => {
      if (!start || event.touches.length !== 1) return;
      const { clientX, clientY } = event.touches[0];
      if (Math.hypot(clientX - start.x, clientY - start.y) > 12) {
        start = null;
        show("그래프는 두 손가락으로 움직이고 확대해요");
      }
    };
    const onWheel = (event: WheelEvent) => {
      if (!event.ctrlKey && !event.metaKey) show("Ctrl(맥은 ⌘)을 누른 채 굴리면 그래프가 확대돼요");
    };
    // 브라우저가 스크롤을 가져가면 그래프는 손을 뗀 걸 모름 → 직접 알려 줌 (안 그러면 다음 탭이 한 번 무시됨)
    const onCancel = (event: PointerEvent) => {
      if (mode === "3d") return;
      const container = box.querySelector<HTMLElement>(".force-graph-container");
      if (!container) return;
      container.dispatchEvent(new PointerEvent("pointerup", { bubbles: true, button: -1, pointerType: event.pointerType }));
      container.dispatchEvent(
        new PointerEvent("pointermove", { bubbles: true, clientX: -1e5, clientY: -1e5, pointerType: event.pointerType }),
      );
    };
    box.addEventListener("touchstart", onStart, { passive: true });
    box.addEventListener("touchmove", onMove, { passive: true });
    box.addEventListener("wheel", onWheel, { passive: true });
    box.addEventListener("pointercancel", onCancel);
    return () => {
      box.removeEventListener("touchstart", onStart);
      box.removeEventListener("touchmove", onMove);
      box.removeEventListener("wheel", onWheel);
      box.removeEventListener("pointercancel", onCancel);
    };
  }, [mode]);

  useEffect(() => {
    if (!hint) return;
    const timer = setTimeout(() => setHint(null), 1800);
    return () => clearTimeout(timer);
  }, [hint]);

  // 3D 전체 화면: Esc로 닫기. 창 안에서 누를 수 있는 건 '2D로 돌아가기' 하나라 Tab은 늘 거기로
  // (3D 그림을 톡 누르면 포커스가 페이지 맨 앞으로 빠져서, 창이 아니라 window에서 받음)
  useEffect(() => {
    if (!fullscreen3d) return;
    const onKey = (event: globalThis.KeyboardEvent) => {
      if (event.key === "Escape") switchMode("2d");
      else if (event.key === "Tab") {
        event.preventDefault();
        closeRef.current?.focus();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  });

  const stateOf = (node: GraphNode) => states[node.id] ?? node.state;
  // 시간 슬라이더로 숨긴 점은 고른 게 아닌 것으로 (패널·키보드·선택 표시 모두)
  const selected = useMemo(() => {
    const node = graph.nodes.find((n) => n.id === selectedId);
    return node && (!shown || shown.nodes.has(node.id)) ? node : null;
  }, [graph.nodes, selectedId, shown]);
  const activeId = selected?.id ?? null;

  // ── 2D ↔ 3D
  function switchMode(next: Mode) {
    if (next === mode) return;
    if (next === "3d" && !canUse3D()) {
      setNotice("이 기기·브라우저에서는 3D를 그릴 수 없어서 2D로 보여줘요.");
      return;
    }
    setNotice("");
    // 휴대폰 3D는 화면 전체 창이라 시간 슬라이더가 안 보임 → 전체 그래프로
    if (next === "3d" && coarse) {
      setPlaying(false);
      setCutoff(null);
    }
    setGraph((prev) => toMode(prev, next));
    fitPending.current = true;
    setMode(next);
    wakeIfHidden();
  }

  function fallbackTo2d() {
    setGraph((prev) => toMode(prev, "2d"));
    fitPending.current = true;
    setMode("2d");
    setNotice("3D 그래프를 열지 못해서 2D로 돌아왔어요.");
  }

  // ── 펼치기
  function unfoldBundle(bundle: FGNode) {
    const members = bundle.members ?? [];
    setGraph((prev) => {
      const link = prev.links.find((l) => endId(l.source) === bundle.id || endId(l.target) === bundle.id);
      const focal = link
        ? endId(link.source) === bundle.id
          ? endId(link.target)
          : endId(link.source)
        : data.centerId;
      const nodeIds = new Set(prev.nodes.map((node) => node.id));
      const linkIds = new Set(prev.links.map((l) => l.id));
      const nodes: FGNode[] = members
        .filter((member) => !nodeIds.has(member.id))
        .map((member) => ({
          id: member.id,
          kind: "address",
          address: member.address,
          side: bundle.side,
          hop: bundle.hop,
          label: shortAddress(member.address),
          valueEth: member.valueEth,
          state:
            member.tag && TERMINAL_CATEGORIES.includes(member.tag.category)
              ? "terminal"
              : bundle.hop >= GRAPH.maxHop
                ? "limit"
                : "expandable",
          group: bundle.label,
          ...(member.tag ? { tag: member.tag } : {}),
          x: bundle.x,
          y: bundle.y,
          ...(mode === "3d" ? { z: bundle.z } : {}),
        }));
      const links: FGLink[] = members
        .map((member) => {
          const [source, target] = bundle.side === "out" ? [focal, member.id] : [member.id, focal];
          return {
            id: linkId(source, target),
            source,
            target,
            valueEth: member.valueEth,
            amountLabel: member.amountLabel,
            count: member.count,
            firstAt: member.firstAt,
            lastAt: member.lastAt,
          };
        })
        .filter((l) => !linkIds.has(l.id));
      return {
        nodes: [...prev.nodes.filter((node) => node.id !== bundle.id), ...nodes],
        links: [
          ...prev.links.filter((l) => endId(l.source) !== bundle.id && endId(l.target) !== bundle.id),
          ...links,
        ],
      };
    });
    // 펼친 무리에서 금액이 가장 큰 점을 골라 둠 (키보드로 이어서 옮겨 다니게).
    // 시간 슬라이더를 옮겨 뒀으면 그 시각까지 보이는 점 중에서. 없으면 가장 먼저 생긴 점 (묶음이 보였다면 그 점은 보임)
    const seen = (member: (typeof members)[number]) =>
      cutoff === null || !Number.isFinite(member.firstAt) || member.firstAt <= cutoff;
    const pool = members.filter(seen);
    const pick =
      pool.length > 0
        ? pool.reduce((best, member) => (member.valueEth > best.valueEth ? member : best))
        : members.reduce<(typeof members)[number] | null>(
            (first, member) => (!first || member.firstAt < first.firstAt ? member : first),
            null,
          );
    setSelectedId(pick?.id ?? null);
    fitPending.current = true;
    wakeIfHidden();
  }

  async function expand(node: FGNode) {
    setLoadingId(node.id);
    setError("");
    try {
      const params = new URLSearchParams({ address: node.id, side: node.side ?? "out", hop: String(node.hop) });
      if (demoId) params.set("demo", demoId);
      const response = await fetch(`/api/graph/expand?${params}`);
      const body = (await response.json().catch(() => null)) as (ExpandResult & { message?: string }) | null;
      if (!response.ok || !body) throw new ExpandError(body?.message ?? EXPAND_FAILED);
      setStates((prev) => ({ ...prev, [body.focus.id]: body.focus.state }));
      setGraph((prev) => {
        const nodeIds = new Set(prev.nodes.map((n) => n.id));
        const linkIds = new Set(prev.links.map((l) => l.id));
        // 새 점은 누른 점 자리에서 퍼져 나오게
        const nodes = body.nodes
          .filter((n) => !nodeIds.has(n.id))
          .map((n) => ({ ...n, x: node.x, y: node.y, ...(mode === "3d" ? { z: node.z } : {}) }));
        const links = body.links.filter((l) => !linkIds.has(l.id)).map((l) => ({ ...l }));
        if (nodes.length === 0 && links.length === 0) return prev;
        return { nodes: [...prev.nodes, ...nodes], links: [...prev.links, ...links] };
      });
      if (body.nodes.length > 0) {
        fitPending.current = true;
        wakeIfHidden();
      }
    } catch (cause) {
      const message = cause instanceof ExpandError ? cause.message : EXPAND_FAILED;
      setError(`${node.label} 펼치기: ${message}`);
    } finally {
      setLoadingId(null);
    }
  }

  function handleNodeClick(node: FGNode) {
    // 시간 슬라이더로 숨긴 점은 아직 없는 점 (막 숨긴 직후엔 라이브러리가 잠깐 누를 수 있게 둠)
    if (!isShown(node.id)) return;
    setSelectedId(node.id);
    setError("");
    if (node.kind === "bundle") {
      unfoldBundle(node);
      return;
    }
    if (node.kind === "address" && stateOf(node) === "expandable" && !loadingId) void expand(node);
  }

  // ── 확대·축소·화면 맞춤 (버튼·키보드)
  function controlTarget(methods: Graph3DMethods): Point3 {
    return (methods.controls() as { target?: Point3 }).target ?? { x: 0, y: 0, z: 0 };
  }

  function zoomBy(factor: number) {
    const ms = reducedMotion ? 0 : 250;
    if (mode === "2d") {
      const methods = graphRef.current;
      if (methods) methods.zoom(methods.zoom() * factor, ms);
      return;
    }
    const methods = graph3dRef.current;
    if (!methods) return;
    const camera = methods.camera().position;
    const target = controlTarget(methods);
    methods.cameraPosition(
      {
        x: target.x + (camera.x - target.x) / factor,
        y: target.y + (camera.y - target.y) / factor,
        z: target.z + (camera.z - target.z) / factor,
      },
      target,
      ms,
    );
  }

  function fit() {
    // 보이는 점만 맞춤. 시작 주소 하나뿐이면 그 점이 화면을 꽉 채우니 전체 그래프에 맞춤
    const filter = shown && shown.nodes.size >= 2 ? (node: object) => isShown((node as FGNode).id) : undefined;
    if (mode === "2d") graphRef.current?.zoomToFit(reducedMotion ? 0 : 500, 40, filter);
    else fit3d(reducedMotion ? 0 : 500);
  }

  // 인쇄 직전 처리(beforeprint)는 처음 한 번 등록해 두니, 늘 지금 그래프 기준으로 맞추게 최신 함수를 ref에
  const fit3dRef = useRef(fit3d);
  useEffect(() => {
    fit3dRef.current = fit3d;
  });

  // 3D 화면 맞춤. 라이브러리의 zoomToFit은 장면에 있는 점만 재서(숨긴 점은 장면에서 빠짐)
  // 보이는 점이 1개뿐이면 그 점에 붙어 버림 → 그땐 숨긴 점까지 모든 점 위치로 카메라 거리를 직접 계산
  function fit3d(ms: number) {
    const methods = graph3dRef.current;
    if (!methods) return;
    if (!shown || shown.nodes.size >= 2) {
      methods.zoomToFit(ms, 40, (node: object) => isShown((node as FGNode).id));
      return;
    }
    const min = { x: Infinity, y: Infinity, z: Infinity };
    const max = { x: -Infinity, y: -Infinity, z: -Infinity };
    for (const node of graph.nodes) {
      for (const axis of ["x", "y", "z"] as const) {
        const value = node[axis] ?? 0;
        min[axis] = Math.min(min[axis], value);
        max[axis] = Math.max(max[axis], value);
      }
    }
    const center = { x: (min.x + max.x) / 2, y: (min.y + max.y) / 2, z: (min.z + max.z) / 2 };
    const camera = methods.camera() as unknown as { fov?: number; aspect?: number };
    const half = Math.tan((((camera.fov ?? 40) / 2) * Math.PI) / 180);
    const aspect = camera.aspect ?? 1;
    const distance =
      Math.max((max.y - min.y) / 2 / half, (max.x - min.x) / 2 / (half * aspect)) * 1.15 + (max.z - min.z) / 2 + 40;
    methods.cameraPosition({ x: center.x, y: center.y, z: center.z + distance }, center, ms);
  }

  // ── 키보드: 방향키로 가까운 점 고르기, Enter로 펼치기 (화면 읽기 프로그램은 아래 패널에서 읽음)
  function screenOf(node: FGNode) {
    if (mode === "3d") return graph3dRef.current?.graph2ScreenCoords(node.x ?? 0, node.y ?? 0, node.z ?? 0);
    return graphRef.current?.graph2ScreenCoords(node.x ?? 0, node.y ?? 0);
  }

  function nearest(from: FGNode, dx: number, dy: number) {
    const origin = screenOf(from);
    if (!origin) return null;
    let best: { node: FGNode; score: number } | null = null;
    for (const node of graph.nodes) {
      if (node.id === from.id || !isShown(node.id)) continue;
      const point = screenOf(node);
      if (!point) continue;
      const along = (point.x - origin.x) * dx + (point.y - origin.y) * dy;
      if (along <= 0) continue;
      const across = Math.abs((point.x - origin.x) * dy - (point.y - origin.y) * dx);
      const score = along + 2 * across;
      if (!best || score < best.score) best = { node, score };
    }
    return best?.node ?? null;
  }

  function keepInView(node: FGNode) {
    const ms = reducedMotion ? 0 : 300;
    if (mode === "2d") {
      const point = screenOf(node);
      if (!point) return;
      const margin = 48;
      if (point.x < margin || point.y < margin || point.x > size.width - margin || point.y > size.height - margin) {
        graphRef.current?.centerAt(node.x, node.y, ms);
      }
      return;
    }
    const methods = graph3dRef.current;
    if (!methods) return;
    const camera = methods.camera().position;
    const target = controlTarget(methods);
    const to = { x: node.x ?? 0, y: node.y ?? 0, z: node.z ?? 0 };
    methods.cameraPosition(
      { x: to.x + camera.x - target.x, y: to.y + camera.y - target.y, z: to.z + camera.z - target.z },
      to,
      ms,
    );
  }

  function onKeyDown(event: KeyboardEvent<HTMLDivElement>) {
    // Ctrl·⌘·Alt 조합은 브라우저 단축키(확대, 뒤로 가기)와 화면 읽기 프로그램 몫
    if (event.ctrlKey || event.metaKey || event.altKey) return;
    const directions: Record<string, [number, number]> = {
      ArrowLeft: [-1, 0],
      ArrowRight: [1, 0],
      ArrowUp: [0, -1],
      ArrowDown: [0, 1],
    };
    const current = selected ?? graph.nodes.find((node) => node.kind === "center") ?? null;
    if (event.key in directions) {
      event.preventDefault();
      if (!current) return;
      // 아직 고른 점이 없으면 시작 주소부터
      const next = selected ? nearest(current, ...directions[event.key]) : current;
      if (!next) return;
      setSelectedId(next.id);
      setError("");
      keepInView(next);
    } else if ((event.key === "Enter" || event.key === " ") && selected) {
      event.preventDefault();
      handleNodeClick(selected);
    } else if (event.key === "Escape") {
      setSelectedId(null);
    } else if (event.key === "+" || event.key === "=") {
      event.preventDefault();
      zoomBy(1.3);
    } else if (event.key === "-") {
      event.preventDefault();
      zoomBy(1 / 1.3);
    } else if (event.key === "0") {
      event.preventDefault();
      fit();
    }
  }

  // ── 2D 그리기 (흰 판 기준 색, components/graph/shared.ts COLOR)
  function drawNode(node: FGNode, ctx: CanvasRenderingContext2D, scale: number) {
    const x = node.x ?? 0;
    const y = node.y ?? 0;
    const r = radius(node);
    const state = stateOf(node);
    // 분류마다 모양도 다르게 (색약이어도 구분되게, lib/shapes.ts). 라벨 없는 시작 주소도 회색 원
    const shape = shapeOf(node.tag?.category);
    const reach = r * SHAPE_REACH[shape];
    ctx.fillStyle = labelStyle(node.tag?.category).color;
    ctx.fill(new Path2D(shapePath(shape, x, y, r)));

    // 테두리 (뾰족한 모양은 꼭짓점이 원보다 바깥이라 그만큼 크게)
    // 시작 주소 = 이중 테두리, 누르면 펼침 = 얇은 테두리, 거래 많아 멈춤 = 점선, 선택 = 청록, 불러오는 중 = 청록 점선
    const ring = (color: string, width: number, gap: number, dash: number[] = []) => {
      ctx.beginPath();
      ctx.arc(x, y, reach + gap / scale, 0, 2 * Math.PI);
      ctx.strokeStyle = color;
      ctx.lineWidth = width / scale;
      ctx.setLineDash(dash.map((d) => d / scale));
      ctx.stroke();
      ctx.setLineDash([]);
    };
    if (node.kind === "center") {
      ring(COLOR.fg, 1.6, 3.5);
      ring(COLOR.fg, 1.1, 7);
    } else if (state === "hub") ring(COLOR.muted, 1.3, 4, [2.6, 2.2]);
    else if (node.kind === "bundle" || (node.kind === "address" && state === "expandable")) {
      ring(COLOR.control, 0.8, 2.6);
    }
    if (node.id === loadingId) ring(COLOR.accent, 1.6, 6.5, [3, 3]);
    else if (node.id === activeId) {
      ring(COLOR.accent, 2.2, node.kind === "center" ? 10 : 6.5);
      // 키보드로 고르는 중이면 한 겹 더 (어디에 있는지 잘 보이게)
      if (keyboard) ring(COLOR.accent, 1, node.kind === "center" ? 13.5 : 10);
    }

    // 확대했을 때는 모든 점에 짧은 주소 (시작 주소·묶음·선택한 점은 drawLabels에서 맨 위에 따로)
    const named = node.tag && NAMED_CATEGORIES.has(node.tag.category) && !node.group;
    if (scale >= 2.5 && node.kind === "address" && node.id !== activeId && !named) {
      ctx.font = `${13 / scale}px ${graphFonts().mono}`;
      ctx.textAlign = "center";
      ctx.textBaseline = "top";
      ctx.fillStyle = COLOR.fg2;
      ctx.fillText(node.label, x, y + reach + 4 / scale);
    }
  }

  // 꼭 읽혀야 하는 이름표(화면 기준 13px)는 모든 선·빛 알갱이를 다 그린 뒤 흰 바탕을 깔고 그림.
  // 겹치면 덜 중요한 것을 생략: 시작 주소 > 선택한 점 > 묶음 이름 > 금액이 큰 라벨 순. 가장자리에서 잘리지 않게 안으로 당김
  function drawLabels(ctx: CanvasRenderingContext2D, scale: number) {
    const { sans, mono } = graphFonts();
    const size = 13 / scale;
    const padX = 6 / scale;
    const padY = 3.5 / scale;
    type Pill = { text: string; x: number; top: number; color: string; font: string; border: string; force: boolean };
    const pills: Pill[] = [];
    const nodes = graph.nodes.filter((node) => isShown(node.id));
    const below = (node: FGNode, gap: number) =>
      (node.y ?? 0) + radius(node) * SHAPE_REACH[shapeOf(node.tag?.category)] + gap / scale;

    for (const node of nodes) {
      if (node.kind === "center") {
        pills.push({
          text: "시작 주소",
          x: node.x ?? 0,
          top: below(node, 11),
          color: COLOR.fg,
          font: `650 ${14 / scale}px ${sans}`,
          border: COLOR.fg,
          force: true,
        });
      }
    }
    const selectedNode = nodes.find((node) => node.id === activeId && node.kind !== "center");
    if (selectedNode) {
      const named = selectedNode.tag && NAMED_CATEGORIES.has(selectedNode.tag.category);
      pills.push({
        text:
          named && selectedNode.tag
            ? selectedNode.tag.name || labelStyle(selectedNode.tag.category).name
            : selectedNode.label,
        x: selectedNode.x ?? 0,
        top: below(selectedNode, 10),
        color: COLOR.fg,
        font: `600 ${size}px ${named ? sans : mono}`,
        border: COLOR.accent,
        force: true,
      });
    }

    // 꽃잎 묶음 (예: "10,000 ETH × 40"): 무리의 가운데 아래에 한 번
    const groups = new Map<string, { label: string; sumX: number; maxY: number; count: number; value: number }>();
    for (const node of nodes) {
      if (node.kind !== "address" || !node.group) continue;
      const key = `${node.group}|${node.side}|${node.hop}`;
      const group = groups.get(key) ?? { label: node.group, sumX: 0, maxY: -Infinity, count: 0, value: 0 };
      group.sumX += node.x ?? 0;
      group.maxY = Math.max(group.maxY, below(node, 0));
      group.count++;
      group.value += node.valueEth;
      groups.set(key, group);
    }
    for (const group of [...groups.values()].sort((a, b) => b.value - a.value)) {
      pills.push({
        text: group.label,
        x: group.sumX / group.count,
        top: group.maxY + 8 / scale,
        color: COLOR.fg,
        font: `650 ${size}px ${sans}`,
        border: COLOR.control,
        force: false,
      });
    }

    // 종착역·제재·피해 지갑 라벨 이름 (해커는 꽃잎마다 있어서 툴팁에서만)
    const named = nodes
      .filter(
        (node) =>
          node.kind === "address" &&
          node.id !== activeId &&
          !node.group &&
          node.tag &&
          NAMED_CATEGORIES.has(node.tag.category),
      )
      .sort((a, b) => b.valueEth - a.valueEth);
    for (const node of named) {
      pills.push({
        text: node.tag!.name || labelStyle(node.tag!.category).name,
        x: node.x ?? 0,
        top: below(node, 6),
        color: COLOR.fg2,
        font: `500 ${size}px ${sans}`,
        border: COLOR.pillBorder,
        force: false,
      });
    }

    // 지금 보이는 캔버스 영역 (그래프 좌표). 이름표를 이 안으로 당김
    const transform = ctx.getTransform();
    const left = -transform.e / transform.a;
    const right = (ctx.canvas.width - transform.e) / transform.a;
    const margin = 6 / scale;
    const placed: { left: number; right: number; top: number; bottom: number }[] = [];
    for (const pill of pills) {
      ctx.font = pill.font;
      const width = ctx.measureText(pill.text).width;
      const half = width / 2 + padX;
      const x = Math.min(Math.max(pill.x, left + margin + half), right - margin - half);
      const rect = { left: x - half, right: x + half, top: pill.top - padY, bottom: pill.top + size + padY };
      const overlaps = placed.some(
        (r) => rect.left < r.right && rect.right > r.left && rect.top < r.bottom && rect.bottom > r.top,
      );
      if (overlaps && !pill.force) continue;
      placed.push(rect);
      ctx.beginPath();
      ctx.roundRect(rect.left, rect.top, rect.right - rect.left, rect.bottom - rect.top, 4 / scale);
      ctx.fillStyle = COLOR.pill;
      ctx.fill();
      ctx.strokeStyle = pill.border;
      ctx.lineWidth = 1 / scale;
      ctx.stroke();
      ctx.textAlign = "center";
      ctx.textBaseline = "top";
      ctx.fillStyle = pill.color;
      ctx.fillText(pill.text, x, pill.top);
    }
  }

  const tooltip = (node: FGNode) =>
    isShown(node.id) ? tooltipHtml(node, stateOf(node), centerAmounts, formatEth) : "";
  const linkLabel = (link: FGLink) => (!shown || shown.links.has(link.id) ? linkTooltip(link) : "");

  function onEngineStop() {
    if (!fitPending.current) return;
    fitPending.current = false;
    fit();
    // 화면 밖이면 맞춤이 끝난 뒤 멈춤 (3D 전체 화면 창은 늘 보이니 멈추지 않음)
    setTimeout(() => {
      if (visible.current || (mode === "3d" && coarse)) return;
      (mode === "3d" ? graph3dRef.current : graphRef.current)?.pauseAnimation();
    }, 700);
  }

  const shownNodes = shown ? shown.nodes.size : graph.nodes.length;
  const shownLinks = shown ? shown.links.size : graph.links.length;
  const ready = size.width > 0;

  const graph3d = (width: number, height: number) => (
    <Fallback onError={fallbackTo2d}>
      <Graph3D
        graphRef={graph3dRef}
        onReady={(methods) => configureForces(methods)}
        onLost={fallbackTo2d}
        width={width}
        height={height}
        graphData={graph}
        nodeLabel={tooltip}
        linkLabel={linkLabel}
        nodeVisibility={nodeVisibility}
        linkVisibility={linkVisibility}
        particles={particles3d}
        selectedId={activeId}
        loadingId={loadingId}
        reducedMotion={reducedMotion}
        wheelNeedsModifier={!fullscreen3d}
        onNodeClick={handleNodeClick}
        onBackgroundClick={() => setSelectedId(null)}
        onEngineStop={onEngineStop}
      />
    </Fallback>
  );

  // '주요 흐름'에서 고르기: 그 방향·분류로 직접 오간 점 중 금액이 가장 큰 점
  const flowNodes = (flow: FlowSummary) =>
    graph.nodes.filter(
      (node) =>
        node.kind === "address" &&
        node.side === flow.side &&
        node.hop === 1 &&
        node.tag?.category === flow.category &&
        isShown(node.id),
    );
  function pickFlow(flow: FlowSummary) {
    const best = flowNodes(flow).reduce<FGNode | null>((top, node) => (!top || node.valueEth > top.valueEth ? node : top), null);
    if (!best) return;
    setSelectedId(best.id);
    setError("");
    keepInView(best);
  }

  const graphNotes: Note[] = data.notes.map((note) => ({ lead: noteLead(note), text: note }));
  const controlsText = coarse
    ? "그래프는 두 손가락으로 옮기고 확대해요."
    : mode === "3d"
      ? "끌어서 돌리고, 오른쪽 버튼으로 끌어서 옮기고, Ctrl(맥은 ⌘)을 누른 채 휠로 확대해요."
      : "끌어서 옮기고, Ctrl(맥은 ⌘)을 누른 채 휠로 확대해요.";

  return (
    // 인쇄(PDF)할 때 그래프 판이 다른 쪽으로 나뉘지 않게
    <div className="print:break-inside-avoid">
      <div className="graph-panel rounded-xl border border-line-strong bg-surface">
        {/* 위 띠: 분류 범례 + 점 모양 읽는 법 | 2D/3D + 확대·축소·맞춤 */}
        <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-3 border-b border-line px-4 py-3">
          <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
            <GraphLegend />
            <StateLegend showParticles={!reducedMotion} showStateMarks={mode === "2d"} />
          </div>
          <div className="flex items-center gap-2 print:hidden">
            <SegmentedControl
              label="그래프 보기 방식"
              options={[
                { value: "2d", label: "2D" },
                { value: "3d", label: "3D" },
              ]}
              value={mode}
              onChange={switchMode}
              buttonRef={(value: Mode) => (value === "3d" ? button3dRef : undefined)}
            />
            <span aria-hidden="true" className="mx-1 h-6 w-px bg-line-strong" />
            <button type="button" onClick={() => zoomBy(1 / 1.3)} aria-label="축소" title="축소" className={ICON_BUTTON}>
              <MinusIcon className="size-4" />
            </button>
            <button type="button" onClick={() => zoomBy(1.3)} aria-label="확대" title="확대" className={ICON_BUTTON}>
              <PlusIcon className="size-4" />
            </button>
            <button type="button" onClick={fit} aria-label="화면 맞춤" title="화면 맞춤" className={ICON_BUTTON}>
              <FitIcon className="size-4" />
            </button>
          </div>
        </div>

        {notice && (
          <p role="status" className="flex items-start gap-2 border-b border-line bg-warn-bg px-4 py-2.5 text-sm text-fg print:hidden">
            <AlertIcon className="mt-[3px] size-4 text-warn" />
            {notice}
          </p>
        )}

        {/* 그래프 + 옆 칸 (넓은 화면은 오른쪽, 좁은 화면은 아래) */}
        <div className="grid lg:grid-cols-[minmax(0,1fr)_320px] print:grid-cols-[minmax(0,1fr)_240px]">
          <div
            ref={boxRef}
            tabIndex={0}
            role="application"
            aria-roledescription="자금 흐름 그래프"
            aria-label={`자금 흐름 그래프: 주소 ${shownNodes}개, 송금 연결 ${shownLinks}개. 방향키로 점을 고르고 Enter로 펼쳐요. 자세한 기록은 아래 송금 기록 표에 있어요.`}
            onKeyDown={onKeyDown}
            onFocus={(event) => setKeyboard(event.currentTarget.matches(":focus-visible"))}
            onBlur={() => setKeyboard(false)}
            className="focus-ring-inset relative h-[420px] overflow-hidden bg-surface bg-dot-grid sm:h-[520px] print:h-auto"
          >
            {ready && mode === "2d" && (
              <ForceGraphCanvas
                graphRef={graphRef}
                onReady={configureForces}
                width={size.width}
                height={size.height}
                graphData={graph}
                backgroundColor="rgba(0,0,0,0)"
                nodeId="id"
                nodeLabel={(node) => tooltip(node as FGNode)}
                nodeVisibility={nodeVisibility}
                linkVisibility={linkVisibility}
                nodeCanvasObject={(node, ctx, scale) => drawNode(node as FGNode, ctx, scale)}
                nodePointerAreaPaint={(node, color, ctx) => {
                  const n = node as FGNode;
                  // 누르는 자리 = 그린 모양 (세모 꼭짓점까지)
                  ctx.fillStyle = color;
                  ctx.beginPath();
                  ctx.arc(n.x ?? 0, n.y ?? 0, radius(n) * SHAPE_REACH[shapeOf(n.tag?.category)] + 3, 0, 2 * Math.PI);
                  ctx.fill();
                }}
                linkLabel={(link) => linkLabel(link as FGLink)}
                linkColor={() => COLOR.link}
                linkWidth={(link) => linkWidth(link as FGLink)}
                linkDirectionalArrowLength={4}
                linkDirectionalArrowRelPos={1}
                linkDirectionalArrowColor={() => COLOR.muted}
                linkDirectionalParticles={particles}
                linkDirectionalParticleSpeed={0.006}
                linkDirectionalParticleWidth={2.4}
                linkDirectionalParticleColor={() => COLOR.fg2}
                onRenderFramePost={drawLabels}
                warmupTicks={40}
                cooldownTicks={150}
                onEngineStop={onEngineStop}
                onNodeClick={(node, up, ...rest: unknown[]) => {
                  // 한 손가락으로 옆으로 쓸다가 점 위에서 손을 떼도 누른 걸로 치지 않음 (10px 넘게 움직이면 쓸기)
                  // force-graph는 (점, 뗀 이벤트, 누른 이벤트)를 넘김 (타입 정의엔 누른 이벤트가 빠져 있음)
                  const down = rest[0] as MouseEvent | undefined;
                  if (down && Math.hypot(up.clientX - down.clientX, up.clientY - down.clientY) > 10) return;
                  handleNodeClick(node as FGNode);
                }}
                // 터치가 되는 기기에서는 빈 곳 탭으로 선택 해제를 안 씀 (이걸 켜면 라이브러리가 손가락 떨림을
                // 끌기로 보고 점 탭을 무시함). 선택 해제는 Esc나 옆 칸의 닫기 버튼으로
                onBackgroundClick={anyCoarse ? undefined : () => setSelectedId(null)}
                enableNodeDrag={!anyCoarse}
                enablePanInteraction={panFilter}
                enableZoomInteraction={wheelFilter}
                showPointerCursor={(obj) => Boolean(obj)}
              />
            )}
            {ready && mode === "3d" && !fullscreen3d && graph3d(size.width, size.height)}
            {fullscreen3d && (
              <p className="p-6 text-sm text-fg-2">
                3D 그래프를 화면 전체로 보고 있어요. 닫으면 2D로 돌아와요.
                <span className="hidden print:inline"> 인쇄에는 3D 그래프가 들어가지 않아요. 2D로 돌아가서 다시 인쇄해 주세요.</span>
              </p>
            )}

            {/* 돈이 흐르는 방향 (2D는 받은 쪽 왼쪽·보낸 쪽 오른쪽으로 고정) */}
            {mode === "2d" && (
              <>
                <span aria-hidden="true" className="pointer-events-none absolute top-3 left-3 inline-flex items-center gap-1 rounded-sm bg-surface px-1.5 text-xs font-semibold text-muted">
                  <ArrowLeftIcon className="size-3.5" />
                  들어온 돈
                </span>
                <span aria-hidden="true" className="pointer-events-none absolute top-3 right-3 inline-flex items-center gap-1 rounded-sm bg-surface px-1.5 text-xs font-semibold text-muted">
                  나간 돈
                  <ArrowRightIcon className="size-3.5" />
                </span>
              </>
            )}

            {hint && (
              <p
                key={hint.key}
                aria-hidden="true"
                className="pointer-events-none absolute inset-x-0 top-1/2 mx-auto w-fit max-w-[90%] -translate-y-1/2 rounded-lg bg-fg px-3 py-2 text-center text-sm text-white"
              >
                {hint.text}
              </p>
            )}
          </div>

          {/* 옆 칸: 고른 점 + 주요 흐름 */}
          <div className="flex min-w-0 flex-col gap-5 border-t border-line p-4 lg:border-t-0 lg:border-l print:border-t-0 print:border-l print:p-3">
            <div aria-live={fullscreen3d ? "off" : "polite"} className="print:hidden">
              {error ? (
                <p className="flex items-start gap-2 text-sm text-fg">
                  <AlertIcon className="mt-[3px] size-4 text-warn" />
                  {error}
                </p>
              ) : selected ? (
                <div className="min-w-0">
                  <div className="flex items-start justify-between gap-2">
                    <p className="pt-1 text-xs text-muted">
                      선택한 점 · {sideText(selected)}
                      {selected.kind === "address" && selected.group && ` · 비슷한 금액 묶음 ${selected.group}`}
                    </p>
                    <button
                      type="button"
                      onClick={() => setSelectedId(null)}
                      aria-label="선택 해제"
                      title="선택 해제"
                      className={buttonClass({ variant: "ghost", size: "sm", icon: true, className: "-mt-1 -mr-2 text-muted" })}
                    >
                      <CloseIcon className="size-4" />
                    </button>
                  </div>
                  {selected.tag && (
                    <p className="mt-1 flex items-center gap-2 text-[15px] font-semibold text-fg">
                      <CategoryMark category={selected.tag.category} className="size-3.5" />
                      {tagText(selected.tag)}
                    </p>
                  )}
                  <p className="mt-1.5 text-[15px] leading-6 text-fg-2">
                    {selected.kind === "bundle" || !selected.address ? (
                      <span className="font-semibold text-fg">{selected.label}</span>
                    ) : (
                      <Address address={selected.address} variant="lines" />
                    )}
                  </p>
                  {selected.tag && (
                    <p className="mt-1.5 text-xs text-muted">
                      {selected.tag.sourceUrl ? (
                        <a
                          href={selected.tag.sourceUrl}
                          target="_blank"
                          rel="noreferrer"
                          className="focus-ring rounded-sm underline decoration-line-control decoration-dotted underline-offset-4 transition-colors hover:text-accent"
                        >
                          <SourceText tag={selected.tag} />
                          <span className="sr-only"> (새 탭)</span>
                        </a>
                      ) : (
                        <SourceText tag={selected.tag} />
                      )}
                    </p>
                  )}
                  <p className="mt-2 text-sm text-fg-2 num">
                    <span className="font-semibold text-fg">
                      {selected.kind === "center" ? centerAmounts : `${formatEth(selected.valueEth)} 상당`}
                    </span>
                    {selected.kind === "address" && ` · ${stateText(selected, stateOf(selected))}`}
                    {selected.id === loadingId && " · 불러오는 중…"}
                    {loadingId &&
                      selected.id !== loadingId &&
                      selected.kind === "address" &&
                      stateOf(selected) === "expandable" &&
                      " · 다른 점을 불러오는 중이에요. 끝나면 다시 눌러 주세요"}
                  </p>
                  {selected.kind === "address" && selected.address && (
                    <div className="mt-3 flex items-center gap-2">
                      <Link
                        href={`/trace/${selected.address}`}
                        prefetch={false}
                        rel="nofollow"
                        className={buttonClass({ variant: "secondary", size: "sm" })}
                      >
                        이 주소 추적
                      </Link>
                      <a
                        href={`https://etherscan.io/address/${selected.address}`}
                        target="_blank"
                        rel="noreferrer"
                        aria-label="Etherscan에서 보기 (새 탭)"
                        title="Etherscan에서 보기"
                        className={buttonClass({ variant: "secondary", size: "sm", icon: true, className: "text-muted" })}
                      >
                        <ExternalIcon className="size-4" />
                      </a>
                    </div>
                  )}
                </div>
              ) : (
                <p className="text-sm text-fg-2">
                  점을 누르면 여기에 자세한 내용이 나와요. <span className="text-muted">{controlsText}</span>
                </p>
              )}
            </div>
            <TopFlows flows={topFlows} canPick={(flow) => flowNodes(flow).length > 0} onPick={pickFlow} />
          </div>
        </div>

        <TimeSlider
          steps={steps}
          cutoff={cutoff}
          onChange={(at) => {
            setPlaying(false);
            setCutoff(at);
          }}
          playing={playing}
          onTogglePlay={togglePlay}
          shownLinks={shownLinks}
          totalLinks={graph.links.length}
        />
      </div>

      {/* 시간 슬라이더를 옮긴 채 인쇄하면 일부만 그려진 그래프라는 걸 종이에도 적음 */}
      {cutoff !== null && (
        <p className="mt-2 hidden text-xs text-muted num print:block">
          시간 슬라이더: 한국 시간 {formatKst(new Date(cutoff).toISOString())}까지 생긴 송금만 그렸어요 · 송금 연결{" "}
          {shownLinks}/{graph.links.length}
        </p>
      )}

      {keyboard && (
        <p className="mt-2 text-xs text-muted print:hidden">
          키보드: 방향키로 점 이동 · Enter로 펼치기 · + / − 확대·축소 · 0 화면 맞춤 · Esc 선택 해제
        </p>
      )}

      <Notes notes={graphNotes} className="mt-4" />

      {fullscreen3d && (
        <div
          role="dialog"
          aria-modal="true"
          aria-label="3D 자금 흐름 그래프"
          // 인쇄할 땐 이 창 말고 리포트를 (창이 화면에 고정돼 있어서 모든 쪽에 찍힘)
          className="fixed inset-0 z-50 flex flex-col bg-canvas print:hidden"
        >
          <div className="flex items-center justify-between gap-3 border-b border-line-strong bg-surface px-4 py-3">
            <p className="text-sm font-semibold text-fg">3D 자금 흐름 그래프</p>
            <button ref={closeRef} type="button" onClick={() => switchMode("2d")} className={buttonClass({ variant: "secondary", size: "sm" })}>
              <CloseIcon className="size-4 text-muted" />
              2D로 돌아가기
            </button>
          </div>
          <div ref={fullRef} className="graph-panel relative flex-1 bg-surface bg-dot-grid">
            {fullSize.width > 0 && graph3d(fullSize.width, fullSize.height)}
          </div>
          {/* 뒤 페이지의 자세히 보기 칸이 가려져서, 오류·불러오는 중·고른 점을 여기서 알려 줌 */}
          <p role="status" className="border-t border-line-strong bg-surface px-4 py-2.5 text-xs text-fg-2">
            {error ? (
              <span className="flex items-start gap-2 text-fg">
                <AlertIcon className="mt-0.5 size-4 shrink-0 text-warn" />
                {error}
              </span>
            ) : loadingId ? (
              "불러오는 중이에요…"
            ) : selected ? (
              <>
                <span className="font-semibold text-fg">
                  {selected.kind === "center"
                    ? "시작 주소"
                    : selected.tag
                      ? tagText(selected.tag)
                      : selected.kind === "bundle"
                        ? selected.label
                        : shortAddress(selected.address ?? selected.id)}
                </span>
                <span className="num">
                  {" · "}
                  {selected.kind === "center" ? centerAmounts : `${formatEth(selected.valueEth)} 상당`}
                  {selected.kind === "address" && ` · ${stateText(selected, stateOf(selected))}`}
                </span>
              </>
            ) : (
              "한 손가락으로 돌리고, 두 손가락으로 확대·이동해요. 점을 누르면 펼쳐져요."
            )}
          </p>
        </div>
      )}
    </div>
  );
}

