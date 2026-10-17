// 공개 자료 → data/labels.json
// 실행: npm run labels   (Node 24가 TypeScript를 바로 실행. .mts = ES 모듈)
// 받은 자료는 글자로만 읽고 실행하지 않음. 원본은 저장하지 않고 필요한 주소만 남김
//
// Etherscan 라벨(eth-labels)은 쓰지 않음: Etherscan 약관(2026-08-13판) 8조가 이름표 복제를
// 제3자를 통해 얻은 경우까지 금지 (2026-10-17 결정). 재사용이 허용된 자료만 씀
// 거래소 지갑(2026-10-17 결정: 검증용으로 공개된 주소까지): 거래소가 준비금 증명용으로 "누구나 확인하라"고
// 직접 공개한 주소만 (바이낸스·Bybit·HTX·Bitfinex·Crypto.com). 약관에 복사·편집물 금지가 적힌 OKX·KuCoin은 안 씀.
// 라이선스가 적힌 곳은 HTX(MIT)뿐이라, 나머지는 출처에 '라이선스 표시 없음'으로 밝힘

import { writeFileSync } from "node:fs";

type Category = "sanctioned" | "hacker" | "mixer" | "victim" | "bridge" | "exchange" | "dex";

// 라벨이 겹치면 앞쪽이 이김. 피해 지갑은 거래소·브릿지보다 앞 (점수에서 해커에게 보낸 돈을 빼야 해서)
const PRIORITY: Category[] = ["sanctioned", "hacker", "mixer", "victim", "bridge", "exchange", "dex"];

type Source = {
  name: string;
  url: string;
  updated: string; // 자료가 마지막으로 바뀐 날. 모르면 ""
  license?: string;
  community?: boolean; // 커뮤니티 조사 자료: 공식 자료에 라벨이 없을 때만 씀
};

type Candidate = { category: Category; name: string; source: string };

const ADDRESS = /^0x[0-9a-f]{40}$/;
const ADDRESS_IN_TEXT = /0x[0-9a-fA-F]{40}(?![0-9a-fA-F])/g; // 트랜잭션 해시(64자리) 일부를 잘못 잡지 않게
const today = new Date().toLocaleDateString("sv-SE", { timeZone: "Asia/Seoul" });

// 일부 거래소 API는 기본 fetch 사용자 이름(user-agent)을 막아서 이름을 붙임
const HEADERS = { "user-agent": "Mozilla/5.0 (Omniscient label builder; non-commercial)" };

async function text(url: string) {
  const response = await fetch(url, { signal: AbortSignal.timeout(60_000), headers: HEADERS });
  if (!response.ok) throw new Error(`${url}: HTTP ${response.status}`);
  return response.text();
}

// 없으면 null (404 등). 여러 경로 중 맞는 걸 찾을 때
async function textOrNull(url: string) {
  const response = await fetch(url, { signal: AbortSignal.timeout(60_000), headers: HEADERS }).catch(() => null);
  return response?.ok ? response.text() : null;
}

// GitHub 파일이 마지막으로 바뀐 날. 실패하면 ""(모름) — 오늘 날짜로 속이지 않음
async function githubUpdated(repo: string, path: string, ref: string) {
  try {
    const response = await fetch(
      `https://api.github.com/repos/${repo}/commits?path=${encodeURIComponent(path)}&sha=${ref}&per_page=1`,
      {
        signal: AbortSignal.timeout(30_000),
        headers: {
          accept: "application/vnd.github+json",
          // 로그인 없이는 시간당 60번 제한 → GITHUB_TOKEN이 있으면 씀 (예: GITHUB_TOKEN=$(gh auth token) npm run labels)
          ...(process.env.GITHUB_TOKEN ? { authorization: `Bearer ${process.env.GITHUB_TOKEN}` } : {}),
        },
      },
    );
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    const [commit] = (await response.json()) as { commit: { committer: { date: string } } }[];
    return commit.commit.committer.date.slice(0, 10);
  } catch (error) {
    console.warn(`⚠ ${repo}/${path} 날짜를 못 가져옴: ${error}`);
    return "";
  }
}

const raw = (repo: string, ref: string, path: string) =>
  `https://raw.githubusercontent.com/${repo}/${ref}/${path}`;

const sources: Record<string, Source> = {};
const candidates = new Map<string, Candidate[]>();

function add(address: string, candidate: Candidate) {
  const key = address.toLowerCase();
  if (!ADDRESS.test(key)) return;
  const list = candidates.get(key) ?? [];
  if (!list.some((c) => c.category === candidate.category && c.source === candidate.source)) {
    list.push(candidate);
  }
  candidates.set(key, list);
}

// 🔴 제재: OFAC 목록만 (ETH + USDT + USDC + ARB + BSC + ETC 파일의 0x 주소)
async function loadOfac() {
  const repo = "0xB10C/ofac-sanctioned-digital-currency-addresses";
  const files = ["ETH", "USDT", "USDC", "ARB", "BSC", "ETC"].map(
    (asset) => `sanctioned_addresses_${asset}.txt`,
  );
  const dates: string[] = [];
  let count = 0;
  for (const file of files) {
    const body = await text(raw(repo, "lists", file));
    for (const line of body.split("\n")) {
      const value = line.trim();
      if (value.startsWith("0x")) {
        add(value, { category: "sanctioned", name: "", source: "ofac" });
        count++;
      }
    }
    dates.push(await githubUpdated(repo, file, "lists"));
  }
  sources.ofac = {
    name: "미국 재무부 OFAC 제재 목록 (0xB10C 정리본)",
    url: `https://github.com/${repo}/tree/lists`,
    updated: dates.filter(Boolean).sort().at(-1) ?? "",
    license: "MIT (데이터는 미국 정부 공개자료)",
  };
  return count;
}

// ⚫ 해커: FBI 공지 PSA250226 (Bybit). Safe의 기계용 사본에서 "PLA-1886" 주석 전까지만 (뒤 16개는 FBI 목록 아님)
async function loadFbi() {
  const repo = "safe-global/safe-transaction-service";
  const path = "config/settings/base.py";
  const body = await text(raw(repo, "main", path));
  const start = body.indexOf("PSA250226");
  const end = body.indexOf("PLA-1886", start);
  if (start < 0 || end < 0) throw new Error("FBI 목록 위치를 못 찾음 (base.py 형식이 바뀜)");
  const found = body.slice(start, end).match(ADDRESS_IN_TEXT) ?? [];
  for (const address of found) add(address, { category: "hacker", name: "Bybit 해킹 관련", source: "fbi" });
  sources.fbi = {
    name: "FBI 공지 PSA250226 (Bybit 해킹)",
    url: "https://www.ic3.gov/PSA/2025/PSA250226",
    updated: "2025-02-26",
  };
  return found.length;
}

// ⚫ 해커: tayvano 사건 기록의 "## Onchain" 부분 (업비트 2019는 여기에만 있음)
// 줄마다 붙은 메모를 읽어서 해커가 아닌 주소를 따로 분류:
//   "Huobi Deposit Address" 같은 거래소 입금 주소 → 거래소
//   Bybit "Malicious Txn"의 콜드월렛·Signer → 해킹 피해 (속아서 서명한 Bybit 쪽 키)
async function loadTayvano(file: string, id: string, incident: string) {
  const repo = "tayvano/lazarus-bluenoroff-research";
  const path = `hacks-and-thefts/${file}`;
  const body = await text(raw(repo, "main", path));
  const section = body.split(/^## Onchain\s*$/m)[1]?.split(/^## /m)[0] ?? "";
  const counts: Record<string, number> = {};
  let heading = "";
  for (const line of section.split("\n")) {
    const title = line.match(/^#{3,4}\s+(.*)$/);
    if (title) {
      heading = title[1].trim();
      continue;
    }
    const [address] = line.match(ADDRESS_IN_TEXT) ?? [];
    if (!address) continue;
    // 주소 뒤 " - 메모" (예: "TC Withdrawer", "Huobi Deposit Address", "Signer 1")
    const note = line.split(address)[1]?.replace(/^\s*-\s*/, "").replace(/\s+/g, " ").trim() ?? "";
    let category: Category = "hacker";
    let name = note ? `${incident} 관련 · ${note}` : `${incident} 관련`;
    const deposit = note.match(/^(.+?)\s+Deposit Address/i);
    if (deposit) {
      category = "exchange";
      name = `${deposit[1]} 입금 주소 (${incident} 자금이 들어감)`;
    } else if (heading === "Malicious Txn" && /signer|cold wallet/i.test(note)) {
      category = "victim";
      name = `${incident} 피해 · ${note.replace(/"/g, "")}`;
    }
    add(address, { category, name, source: id });
    counts[category] = (counts[category] ?? 0) + 1;
  }
  sources[id] = {
    name: `tayvano/lazarus-bluenoroff-research ${file}`,
    url: `https://github.com/${repo}/blob/main/${path}`,
    updated: await githubUpdated(repo, path, "main"),
    license: "CC0",
    community: true,
  };
  return counts;
}

// 🟣 믹서: Tornado Cash 공식 문서의 이더리움 메인넷 풀 + 라우터·Proxy·Mixer 1/2
// (검증기·Poseidon·거버넌스 같은 부품은 돈이 섞이는 곳이 아니라서 제외)
async function loadTornadoDocs() {
  const repo = "tornadocash/docs";
  const ref = "en"; // 기본 브랜치 (master 없음)
  const path = "general/tornado-cash-smart-contracts.md";
  const body = await text(raw(repo, ref, path));
  const section = (start: string) => body.split(start)[1]?.split(/^#{2,3} |^\* /m)[0] ?? "";
  const rows = (part: string) =>
    part.split("\n").flatMap((line) => {
      const name = line.match(/^\|\s*([^|]+?)\s*\|/)?.[1] ?? "";
      // 링크 주소(etherscan.io/address/0x…)에서 뽑음. 문서 표시 글자가 깨진 줄이 있어서
      return [...line.matchAll(/etherscan\.io\/address\/(0x[0-9a-fA-F]{40})/g)].map(([, address]) => ({ name, address }));
    });
  let count = 0;
  for (const { name, address } of rows(body.split("* Ethereum Mainnet")[1]?.split(/^\* /m)[0] ?? "")) {
    add(address, { category: "mixer", name: `Tornado Cash ${name} 풀`, source: "tornado" });
    count++;
  }
  const keep: Record<string, string> = {
    Proxy: "Tornado Cash Proxy",
    "Mixer 1": "Tornado Cash Mixer 1 (구버전)",
    "Mixer 2": "Tornado Cash Mixer 2 (구버전)",
    "Tornado Router": "Tornado Cash 라우터",
  };
  for (const { name, address } of [...rows(section("### Other Contracts")), ...rows(section("### Relayer Registry"))]) {
    if (!keep[name]) continue;
    add(address, { category: "mixer", name: keep[name], source: "tornado" });
    count++;
  }
  sources.tornado = {
    name: "Tornado Cash 공식 문서 (컨트랙트 목록)",
    url: `https://github.com/${repo}/blob/${ref}/${path}`,
    updated: await githubUpdated(repo, path, ref),
  };
  return count;
}

// 🟢 DEX: Uniswap 공식 문서의 이더리움 메인넷 라우터 (돈을 교환하는 입구)
async function loadUniswap() {
  const pages = {
    v2: "https://developers.uniswap.org/llms.mdx/docs/protocols/v2/deployments",
    v3: "https://developers.uniswap.org/llms.mdx/docs/protocols/v3/deployments/v3-ethereum-deployments",
  };
  const found: [string, string][] = [];
  const v2 = await text(pages.v2);
  // | Mainnet | `팩토리` | `V2Router02` |
  const v2Row = v2.split("\n").find((line) => /^\|\s*Mainnet\s*\|/.test(line));
  const v2Router = v2Row?.match(ADDRESS_IN_TEXT)?.[1];
  if (v2Router) found.push([v2Router, "Uniswap V2 라우터"]);
  const v3 = await text(pages.v3);
  // 표의 첫 번째 주소 열 = Mainnet (두 번째는 Sepolia 테스트넷)
  for (const [contract, name] of [
    ["SwapRouter", "Uniswap V3 라우터"],
    ["SwapRouter02", "Uniswap SwapRouter02"],
    ["UniversalRouter", "Uniswap Universal Router"],
  ]) {
    const row = v3.split("\n").find((line) => line.startsWith(`| [${contract}]`));
    const mainnet = row?.split("|")[2]?.match(ADDRESS_IN_TEXT)?.[0];
    if (mainnet) found.push([mainnet, name]);
  }
  for (const [address, name] of found) add(address, { category: "dex", name, source: "uniswap" });
  sources.uniswap = {
    name: "Uniswap 공식 문서 (배포 주소)",
    url: "https://developers.uniswap.org/docs/protocols/v3/deployments/v3-ethereum-deployments",
    updated: today,
  };
  return found.length;
}

// 🔵 브릿지: THORChain 라우터 (돈이 비트코인 등 다른 체인으로 나가는 출구)
// 2026-10-17 THORNode inbound_addresses(공식 문서에 나온 Liquify 공개 노드)로 현재 이더리움 라우터 확인:
// 0xD37B…7146 (컨트랙트 소스 머리말 'Router Version: 4.1'). 이더리움엔 이보다 새 라우터 없음
function loadThorchain() {
  add("0x3624525075b88B24ecc29CE226b0CEc1fFcB6976", { category: "bridge", name: "THORChain 라우터 (구버전)", source: "thorchain" });
  add("0xD37BbE5744D730a1d98d8DC97c42F0Ca46aD7146", { category: "bridge", name: "THORChain 라우터 v4.1 (현재)", source: "thorchain" });
  sources.thorchain = {
    name: "THORChain 라우터 (THORNode inbound_addresses)",
    url: "https://dev.thorchain.org/concepts/connecting-to-thorchain.html",
    updated: "2026-10-17",
  };
}

const NO_LICENSE = "라이선스 표시 없음 (거래소가 준비금 확인용으로 직접 공개)";

// 🟢 거래소: 바이낸스 준비금 증명 주소 목록 (공식 API, 'Download All Address'와 같은 자료). 이더리움 네트워크만
async function loadBinance() {
  const body = JSON.parse(await text("https://www.binance.com/bapi/apex/v1/public/apex/market/por/address")) as {
    data?: { network: string; address: string; thirdPartyCustodianName?: string; createTime?: number }[];
  };
  const rows = (body.data ?? []).filter((row) => row.network === "ETH");
  if (rows.length === 0) throw new Error("바이낸스 목록이 비었음 (API 형식이 바뀜)");
  for (const row of rows) {
    const custodian = row.thirdPartyCustodianName?.trim();
    add(row.address, {
      category: "exchange",
      name: custodian ? `바이낸스 준비금 지갑 (${custodian} 보관)` : "바이낸스 준비금 지갑",
      source: "binance-por",
    });
  }
  const latest = Math.max(...rows.map((row) => row.createTime ?? 0));
  sources["binance-por"] = {
    name: "바이낸스 준비금 증명 (Proof of Reserves) 주소 목록",
    url: "https://www.binance.com/en/proof-of-reserves",
    updated: latest > 0 ? new Date(latest).toLocaleDateString("sv-SE", { timeZone: "Asia/Seoul" }) : today,
    license: NO_LICENSE,
  };
  return new Set(rows.map((row) => row.address.toLowerCase())).size;
}

// 🟢 거래소: Bybit 월별 준비금 증명 CSV (Bybit 서버). 가장 최근 달 파일을 찾아서 '…-Ethereum' 줄의 주소만
async function loadBybit() {
  const now = new Date();
  for (let back = 0; back < 4; back++) {
    const month = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - back, 1));
    const yyyymm = `${month.getUTCFullYear()}${String(month.getUTCMonth() + 1).padStart(2, "0")}`;
    const url = `https://api2.bybit.com/common-static/por/bybit_por_${yyyymm}.csv`;
    const body = await textOrNull(url);
    if (!body) continue;
    const found = new Set<string>();
    for (const line of body.split(/\r?\n/)) {
      const [coin, , , ...rest] = line.split(",");
      if (!coin?.endsWith("-Ethereum")) continue;
      for (const address of rest.join(",").match(ADDRESS_IN_TEXT) ?? []) found.add(address.toLowerCase());
    }
    if (found.size === 0) throw new Error(`Bybit ${yyyymm} 파일에 이더리움 주소가 없음 (형식이 바뀜)`);
    for (const address of found) add(address, { category: "exchange", name: "Bybit 준비금 지갑", source: "bybit-por" });
    sources["bybit-por"] = {
      name: `Bybit 준비금 증명 (Proof of Reserves) ${yyyymm.slice(0, 4)}-${yyyymm.slice(4)} 파일`,
      url, // 준비금 증명 페이지는 지역마다 다르게 열려서 실제 파일 주소를 씀
      updated: `${yyyymm.slice(0, 4)}-${yyyymm.slice(4)}`,
      license: NO_LICENSE,
    };
    return found.size;
  }
  throw new Error("Bybit 준비금 증명 파일을 못 찾음 (최근 4달)");
}

// 🟢 거래소: HTX(옛 후오비) 공식 GitHub의 준비금 증명 스냅샷 (MIT). 2022-12부터 모든 스냅샷을 합침
// (예전 지갑도 옛 해킹 자금 흐름에 나와서). 이더리움 줄 = 코인이 ETH이거나, 스냅샷 높이가 ETH 줄과 같은 토큰
async function loadHtx() {
  const repo = "huobiapi/Tool-Node.js-VerifyAddress";
  const response = await fetch(`https://api.github.com/repos/${repo}/tags?per_page=100`, {
    signal: AbortSignal.timeout(30_000),
    headers: {
      accept: "application/vnd.github+json",
      ...(process.env.GITHUB_TOKEN ? { authorization: `Bearer ${process.env.GITHUB_TOKEN}` } : {}),
    },
  });
  if (!response.ok) throw new Error(`HTX 태그 목록: HTTP ${response.status}`);
  const tags = ((await response.json()) as { name: string }[]).map((tag) => tag.name).filter((name) => name.startsWith("por_"));
  const found = new Set<string>();
  let snapshots = 0;
  for (const tag of ["main", ...tags]) {
    // 2023-07까지는 snapshot/huobi_por_<날짜>.csv, 그 뒤로는 snapshot/huobi_por.csv
    const body =
      (await textOrNull(raw(repo, tag, "snapshot/huobi_por.csv"))) ??
      (await textOrNull(raw(repo, tag, `snapshot/huobi_por_${tag.replace(/^por_/, "")}.csv`)));
    if (!body) continue;
    snapshots++;
    const rows = (body.split(/^coin,address.*$/m)[1] ?? "")
      .split(/\r?\n/)
      .map((line) => line.split(","))
      .filter(([, address]) => /^0x[0-9a-fA-F]{40}$/.test(address ?? ""));
    const ethHeights = new Set(rows.filter(([coin, , height]) => coin === "ETH" && height !== "-").map(([, , height]) => height));
    for (const [coin, address, height] of rows) {
      if (coin === "ETH" || ethHeights.has(height)) found.add(address.toLowerCase());
    }
  }
  if (found.size === 0) throw new Error("HTX 스냅샷에서 이더리움 주소를 못 찾음 (형식이 바뀜)");
  for (const address of found) add(address, { category: "exchange", name: "HTX(옛 후오비) 준비금 지갑", source: "htx-por" });
  sources["htx-por"] = {
    name: `HTX(옛 후오비) 준비금 증명 스냅샷 (공식 GitHub, ${snapshots}회분)`,
    url: `https://github.com/${repo}`,
    updated: await githubUpdated(repo, "snapshot/huobi_por.csv", "main"),
    license: "MIT (Copyright (c) 2022 Damon)",
  };
  return found.size;
}

// 🟢 거래소: Bitfinex 지갑 목록 (Bitfinex CTO가 공식 GitHub에 올림). 'ETH/ERC20' 줄만
async function loadBitfinex() {
  const repo = "bitfinexcom/pub";
  const body = await text(raw(repo, "main", "wallets.txt"));
  const kinds: [RegExp, string][] = [
    [/\(old\) hot wallet/i, "Bitfinex 옛 핫월렛"],
    [/hot wallet/i, "Bitfinex 핫월렛"],
    [/cold wallet/i, "Bitfinex 콜드월렛"],
  ];
  let count = 0;
  for (const line of body.split("\n")) {
    const [address] = line.match(ADDRESS_IN_TEXT) ?? [];
    const note = line.split(" - ")[1] ?? "";
    if (!address || !note.startsWith("ETH/ERC20")) continue;
    const name = kinds.find(([pattern]) => pattern.test(note))?.[1] ?? "Bitfinex 지갑";
    add(address, { category: "exchange", name, source: "bitfinex" });
    count++;
  }
  sources.bitfinex = {
    name: "Bitfinex 지갑 목록 (bitfinexcom/pub wallets.txt)",
    url: `https://github.com/${repo}/blob/main/wallets.txt`,
    updated: await githubUpdated(repo, "wallets.txt", "main"),
    license: "라이선스 표시 없음 (거래소 CTO가 공식 GitHub에 공개)",
  };
  return count;
}

// 🟢 거래소: Crypto.com 공식 블로그 'Transparency First' (2022-11-11)의 이더리움 콜드월렛 4개
// 페이지가 지역마다 다르게 열려서 주소를 직접 적어 둠 (웹 아카이브 2022-11-11 사본에서 확인)
function loadCryptoCom() {
  for (const address of [
    "0x72A53cDBBcc1b9efa39c834A540550e23463AAcB",
    "0x6262998Ced04146fA42253a5C0AF90CA02dfd2A3",
    "0xCFFAd3200574698b78f32232aa9D63eABD290703",
    "0x7758E507850dA48cd47df1fB5F875c23E3340c50",
  ]) {
    add(address, { category: "exchange", name: "Crypto.com 콜드월렛", source: "cryptocom" });
  }
  sources.cryptocom = {
    name: "Crypto.com 공식 블로그 'Transparency First'",
    url: "https://web.archive.org/web/20221111144006/https://crypto.com/company-news/transparency-first",
    updated: "2022-11-11",
    license: NO_LICENSE,
  };
  return 4;
}

// 해킹 피해 지갑: 공개 사고 분석에 나온 주소 (점수에서 해커에게 보낸 돈을 빼려고)
function loadVictims() {
  add("0x1Db92e2EeBC8E0c075a02BeA49a2935BcD2dFCF4", { category: "victim", name: "Bybit 콜드월렛", source: "certik-bybit" });
  sources["certik-bybit"] = {
    name: "CertiK Bybit 사고 기술 분석",
    url: "https://www.certik.com/skynet-report/bybit-incident-technical-analysis",
    updated: "2025-02-21",
  };
  // 업비트 공지 #1085: "이더리움 핫월렛에서 ETH 342,000개가 알 수 없는 지갑(0xa098…c029)으로 전송"
  // + 블록체인 기록: 그 시각(2019-11-27 04:06 UTC) 342,000 ETH를 보낸 주소 = 0x5E03…ab89
  // (tx 0xca4e0aa223e3190ab477efb25617eff3a42af7bdb29cdb7dc9e7935ea88626b4)
  add("0x5E032243d507C743b061eF021e2EC7fcc6d3ab89", {
    category: "victim",
    name: "업비트 이더리움 핫월렛 (2019 해킹 피해)",
    source: "upbit-notice",
  });
  sources["upbit-notice"] = {
    name: "업비트 공지 #1085 (2019-11-27) + 블록체인 거래 기록",
    url: "https://upbit.com/service_center/notice?id=1085",
    updated: "2019-11-27",
  };
}

function pick(list: Candidate[]): Candidate {
  // 커뮤니티 자료(tayvano)는 공식 자료에 아무 라벨도 없을 때만 씀
  const official = list.filter((c) => !sources[c.source]?.community);
  const pool = official.length > 0 ? official : list;
  return [...pool].sort((a, b) => PRIORITY.indexOf(a.category) - PRIORITY.indexOf(b.category))[0];
}

async function main() {
  console.log("자료 받는 중…");
  const ofac = await loadOfac();
  const fbi = await loadFbi();
  const tayvano = {
    upbit: await loadTayvano("upbit.md", "tayvano-upbit", "업비트 2019 해킹"),
    bybit: await loadTayvano("bybit.md", "tayvano-bybit", "Bybit 해킹"),
    ronin: await loadTayvano("ronin_bridge.md", "tayvano-ronin", "Ronin 해킹"),
  };
  const tornado = await loadTornadoDocs();
  const uniswap = await loadUniswap();
  loadThorchain();
  const exchanges = {
    binance: await loadBinance(),
    bybit: await loadBybit(),
    htx: await loadHtx(),
    bitfinex: await loadBitfinex(),
    cryptocom: loadCryptoCom(),
  };
  loadVictims();

  const labels: Record<string, [Category, string, string]> = {};
  for (const [address, list] of [...candidates].sort(([a], [b]) => a.localeCompare(b))) {
    const chosen = pick(list);
    labels[address] = [chosen.category, chosen.name, chosen.source];
  }

  const counts: Record<string, number> = {};
  for (const [category] of Object.values(labels)) counts[category] = (counts[category] ?? 0) + 1;

  // 한 주소에 한 줄씩 (나중에 다시 만들 때 바뀐 부분만 보이게)
  const lines = Object.entries(labels).map(([address, value]) => `    ${JSON.stringify(address)}: ${JSON.stringify(value)}`);
  const output =
    "{\n" +
    `  "generatedAt": ${JSON.stringify(today)},\n` +
    `  "format": "labels[address] = [category, name, sourceId]",\n` +
    `  "sources": ${JSON.stringify(sources, null, 2).replace(/\n/g, "\n  ")},\n` +
    `  "labels": {\n${lines.join(",\n")}\n  }\n}\n`;
  writeFileSync(new URL("../data/labels.json", import.meta.url), output);

  console.log(
    JSON.stringify({ ofac, fbi, tayvano, tornado, uniswap, exchanges, total: Object.keys(labels).length, counts }, null, 2),
  );
}

await main();
