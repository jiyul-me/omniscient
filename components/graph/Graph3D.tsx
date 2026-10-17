"use client";

// 3D 그래프. three.js가 커서 '3D' 버튼을 눌렀을 때만 내려받음 (FlowGraph의 next/dynamic)
// 2D와 같은 데이터·색·모양(lib/shapes.ts의 3D판)·빛 알갱이·누르면 펼치기
import ForceGraph3D, { type ForceGraphMethods } from "react-force-graph-3d";
import { useCallback, useEffect, useRef, useState, type RefObject } from "react";
import * as THREE from "three";
import { CSS2DObject, CSS2DRenderer } from "three/examples/jsm/renderers/CSS2DRenderer.js";
import { labelStyle } from "@/lib/categories";
import { shapeOf, type Shape } from "@/lib/shapes";
import { COLOR, NAMED_CATEGORIES, SHAPE_REACH, linkWidth, radius, type FGLink, type FGNode, type GraphState } from "./shared";

export type Graph3DMethods = ForceGraphMethods<FGNode, FGLink>;

// 2D 모양과 앞에서 봤을 때 같은 꼴: 원 = 공, 네모 = 상자, 마름모 = 팔면체, 세모 = 삼각뿔, 육각형 = 육각 기둥
function geometryFor(shape: Shape) {
  switch (shape) {
    case "square":
      return new THREE.BoxGeometry(1.6, 1.6, 1.6);
    case "diamond":
      return new THREE.OctahedronGeometry(1.25);
    case "triangle":
      return new THREE.ConeGeometry(1.25, 2, 3);
    case "triangle-down":
      return new THREE.ConeGeometry(1.25, 2, 3).rotateZ(Math.PI);
    case "hexagon":
      return new THREE.CylinderGeometry(1.1, 1.1, 1, 6).rotateX(Math.PI / 2);
    default:
      return new THREE.SphereGeometry(1, 16, 12);
  }
}

// 모양·색마다 한 번만 만들어 여러 점이 같이 씀
const geometries = new Map<Shape, THREE.BufferGeometry>();
const materials = new Map<string, THREE.Material>();
function geometry(shape: Shape) {
  if (!geometries.has(shape)) geometries.set(shape, geometryFor(shape));
  return geometries.get(shape)!;
}
function material(color: string) {
  if (!materials.has(color)) materials.set(color, new THREE.MeshLambertMaterial({ color }));
  return materials.get(color)!;
}

// 점 이름표 (HTML이라 한글 글꼴·크기가 화면 글자와 같음, app/globals.css .graph3d-label)
function label(text: string, strong: boolean) {
  const div = document.createElement("div");
  div.className = strong ? "graph3d-label graph3d-label-strong" : "graph3d-label";
  div.textContent = text;
  const object = new CSS2DObject(div);
  object.center.set(0.5, -0.6); // 점 아래쪽
  return object;
}

// 선택·불러오는 중 표시: 청록 철망 공 하나를 그 점의 3D 묶음에 옮겨 붙임 (three.js의 add는 전 부모에서 떼어 냄)
type Cage = THREE.Mesh<THREE.IcosahedronGeometry, THREE.MeshBasicMaterial>;
function createCage(): Cage {
  return new THREE.Mesh(
    new THREE.IcosahedronGeometry(1, 1),
    new THREE.MeshBasicMaterial({ color: COLOR.accent, wireframe: true, transparent: true, opacity: 0.8 }),
  );
}
function placeCage(cage: Cage, group: THREE.Group, node: FGNode, loading: boolean) {
  cage.scale.setScalar(SHAPE_REACH[shapeOf(node.tag?.category)] + 0.6);
  cage.material.opacity = loading ? 0.35 : 0.8;
  group.add(cage);
}

const linkColor = () => COLOR.link;
const particleColor = () => COLOR.fg2;
const width3d = (link: FGLink) => linkWidth(link) * 0.5;

type Props = {
  graphRef: RefObject<Graph3DMethods | undefined>;
  onReady: (methods: Graph3DMethods) => void;
  onLost: () => void; // WebGL이 끊기면 2D로
  width: number;
  height: number;
  graphData: GraphState;
  nodeLabel: (node: FGNode) => string;
  linkLabel: (link: FGLink) => string;
  nodeVisibility: boolean | ((node: FGNode) => boolean);
  linkVisibility: boolean | ((link: FGLink) => boolean);
  particles: number | ((link: FGLink) => number);
  selectedId: string | null;
  loadingId: string | null;
  reducedMotion: boolean;
  wheelNeedsModifier: boolean; // true = 그냥 휠은 페이지 스크롤, Ctrl(⌘)+휠만 확대 (2D와 같게). 화면 전체 창은 false
  onNodeClick: (node: FGNode) => void;
  onBackgroundClick: () => void;
  onEngineStop: () => void;
};

export default function Graph3D({
  graphRef,
  onReady,
  onLost,
  width,
  height,
  graphData,
  nodeLabel,
  linkLabel,
  nodeVisibility,
  linkVisibility,
  particles,
  selectedId,
  loadingId,
  reducedMotion,
  wheelNeedsModifier,
  onNodeClick,
  onBackgroundClick,
  onEngineStop,
}: Props) {
  // 이름표용 HTML 렌더러는 처음 한 번만 (바꾸면 라이브러리가 반영하지 않음)
  const [css2d] = useState(() => new CSS2DRenderer());
  // 점 id → 3D 묶음 (선택 표시를 옮겨 붙이려고). three.js 객체는 직접 고쳐 쓰는 값이라 ref에
  const groups = useRef(new Map<string, THREE.Group>());
  const cage = useRef<Cage | null>(null);
  // 철망을 붙일 점. 시간 슬라이더로 숨겼다 다시 보이면 라이브러리가 점 모양을 새로 만들어서, 새로 만들 때도 붙임
  const target = useRef<{ id: string | null; loading: boolean }>({ id: null, loading: false });
  const wheelGate = useRef(wheelNeedsModifier);
  useEffect(() => {
    wheelGate.current = wheelNeedsModifier;
  }, [wheelNeedsModifier]);

  // 점 하나의 3D 모양 (렌더마다 새로 만들면 모든 점을 다시 만들어서 이 함수는 고정)
  const nodeObject = useCallback(
    (node: FGNode) => {
      const group = new THREE.Group();
      const shape = shapeOf(node.tag?.category);
      // 흰 판이라 해커(거의 검정)도 잘 보임. 라벨 없는 시작 주소는 회색 공 (2D와 같게)
      const mesh = new THREE.Mesh(geometry(shape), material(labelStyle(node.tag?.category).color));
      group.add(mesh);
      group.scale.setScalar(radius(node));
      if (node.kind === "center") group.add(label("시작 주소", true));
      else if (node.tag && NAMED_CATEGORIES.has(node.tag.category) && !node.group) {
        group.add(label(node.tag.name || labelStyle(node.tag.category).name, false));
      }
      // 시간 슬라이더로 숨기면 라이브러리가 이 묶음을 장면에서 빼는데, 이름표(HTML)는 묶음의 자식이라 저절로 안 지워짐
      // → 직접 지움 (안 지우면 숨긴 점 이름표가 그 자리에 굳어 남고, 다시 보일 때 하나 더 생김)
      group.addEventListener("removed", () => {
        group.traverse((child) => {
          if (child instanceof CSS2DObject) child.element.remove();
        });
        if (groups.current.get(node.id) === group) groups.current.delete(node.id);
      });
      groups.current.set(node.id, group);
      if (node.id === target.current.id) {
        cage.current ??= createCage();
        placeCage(cage.current, group, node, target.current.loading);
      }
      return group;
    },
    [],
  );

  useEffect(() => {
    const id = loadingId ?? selectedId;
    target.current = { id, loading: Boolean(loadingId) };
    cage.current ??= createCage();
    const mesh = cage.current;
    mesh.parent?.remove(mesh);
    const group = id ? groups.current.get(id) : undefined;
    const node = id ? graphData.nodes.find((n) => n.id === id) : undefined;
    if (group && node) placeCage(mesh, group, node, Boolean(loadingId));
  }, [graphData.nodes, selectedId, loadingId]);

  // 다 쓰면 WebGL 연결을 돌려줌 (3D를 여러 번 켜고 끄면 브라우저가 오래된 연결을 끊어 버림)
  // 라이브러리가 정말 정리했는지(장면이 비었는지)로 판단: 개발 모드(StrictMode)의 가짜 언마운트는 장면을 안 비움.
  // 다른 페이지로 갔다 오는 경우(Next가 이전 페이지를 숨겨 두는 Activity)는 캔버스가 아직 붙어 있어도 장면은 비어 있음
  useEffect(() => {
    const methods = graphRef.current;
    if (!methods) return;
    const renderer = methods.renderer();
    const canvas = renderer.domElement;
    const scene = methods.scene();
    const controls = methods.controls() as { enableZoom?: boolean };
    onReady(methods);
    const lost = () => {
      if (canvas.isConnected) onLost();
    };
    // 그냥 휠: 카메라 확대를 잠깐 꺼서 페이지가 내려가게 (캔버스보다 먼저 받는 capture 단계), 끝나면 다시 켬
    const host = canvas.parentElement ?? canvas;
    const gateWheel = (event: WheelEvent) => {
      controls.enableZoom = !wheelGate.current || event.ctrlKey || event.metaKey;
    };
    const reopenWheel = () => {
      controls.enableZoom = true;
    };
    canvas.addEventListener("webglcontextlost", lost);
    host.addEventListener("wheel", gateWheel, { capture: true, passive: true });
    host.addEventListener("wheel", reopenWheel, { passive: true });
    return () => {
      canvas.removeEventListener("webglcontextlost", lost);
      host.removeEventListener("wheel", gateWheel, { capture: true });
      host.removeEventListener("wheel", reopenWheel);
      setTimeout(() => {
        if (scene.children.length > 0) return;
        renderer.forceContextLoss();
        const global = window as unknown as { scene?: unknown };
        if (global.scene === scene) delete global.scene;
      }, 0);
    };
    // 처음 한 번만
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <ForceGraph3D<FGNode, FGLink>
      ref={graphRef as React.MutableRefObject<Graph3DMethods | undefined>}
      width={width}
      height={height}
      graphData={graphData}
      backgroundColor="rgba(0,0,0,0)"
      showNavInfo={false}
      controlType="orbit"
      enableNodeDrag={false}
      extraRenderers={[css2d as unknown as THREE.WebGLRenderer]}
      nodeId="id"
      nodeThreeObject={nodeObject}
      nodeLabel={nodeLabel}
      nodeVisibility={nodeVisibility}
      linkVisibility={linkVisibility}
      linkLabel={linkLabel}
      linkColor={linkColor}
      linkWidth={width3d}
      linkOpacity={0.6}
      linkDirectionalArrowLength={0}
      linkDirectionalParticles={particles}
      linkDirectionalParticleSpeed={0.006}
      linkDirectionalParticleWidth={1.4}
      linkDirectionalParticleColor={particleColor}
      warmupTicks={reducedMotion ? 120 : 40}
      cooldownTicks={150}
      onEngineStop={onEngineStop}
      onNodeClick={onNodeClick}
      onBackgroundClick={onBackgroundClick}
      showPointerCursor={(obj) => Boolean(obj)}
    />
  );
}
