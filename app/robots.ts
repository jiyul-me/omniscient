import type { MetadataRoute } from "next";

// /trace/ 페이지는 열 때마다 Alchemy 사용량(CU)을 써서 검색 로봇이 따라 들어오지 않게 막음
export default function robots(): MetadataRoute.Robots {
  return {
    rules: { userAgent: "*", allow: "/", disallow: ["/trace/", "/api/"] },
  };
}
