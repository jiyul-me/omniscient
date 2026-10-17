import { defineConfig } from "vitest/config";

// 단위 테스트 (npm test). 지금은 서버·화면과 상관없는 순수 계산(lib/*.test.ts)만
export default defineConfig({
  test: {
    include: ["lib/**/*.test.ts"],
  },
});
