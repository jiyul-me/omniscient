// three-render-objects가 'three/webgpu'를 불러오지만 WebGPU는 쓰지 않음 (useWebGPU 기본 false).
// 그대로 두면 안 쓰는 코드가 3D 묶음에 약 170KB(gzip) 들어가서 빈 것으로 바꿔 넣음 (next.config.ts resolveAlias)
// react-force-graph-3d·three-render-objects를 올릴 때 여전히 안 쓰는지 다시 확인할 것
export const WebGPURenderer = undefined;
