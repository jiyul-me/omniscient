import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  /* config options here */
  cacheComponents: true,
  // 실행 중에 파일로 읽는 라벨 목록(lib/labels.ts)과 데모 저장본(lib/snapshots.ts)을 서버 배포물에 꼭 넣음
  // (import로 넣으면 큰 JSON을 TypeScript가 검사·번들해서 느려짐)
  outputFileTracingIncludes: {
    "/trace/*": ["./data/labels.json", "./data/demos/*.json"],
    "/api/**": ["./data/labels.json", "./data/demos/*.json"],
  },
  partialPrefetching: true,
  turbopack: {
    // 3D 모드: three.js의 WebGPU 부분은 안 써서 빈 파일로 (lib/stubs/three-webgpu.js)
    resolveAlias: {
      "three/webgpu": { browser: "./lib/stubs/three-webgpu.js" },
    },
    rules: {
      "*.css": {
        loaders: ["@tailwindcss/turbopack"],
        as: "*.css",
      },
    },
  },
};

export default nextConfig;
