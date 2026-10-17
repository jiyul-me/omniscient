// 인정하는 토큰 = 컨트랙트 주소(소문자) 화이트리스트. 심볼로 매칭 금지 (가짜 "USDT"가 많음)
// decimals는 토큰마다 다름 → 금액은 항상 이 값으로 formatUnits
// peg: ETH 환산 방법 (eth = 1:1 근사, usd = ETH 시세로 나눔, btc = BTC/ETH 시세 비율)
export type TokenInfo = {
  symbol: string;
  decimals: number;
  peg: "eth" | "usd" | "btc";
};

export const ETH: TokenInfo = { symbol: "ETH", decimals: 18, peg: "eth" };

export const TOKENS: Record<string, TokenInfo> = {
  "0xc02aaa39b223fe8d0a0e5c4f27ead9083c756cc2": { symbol: "WETH", decimals: 18, peg: "eth" },
  "0xa0b86991c6218b36c1d19d4a2e9eb0ce3606eb48": { symbol: "USDC", decimals: 6, peg: "usd" },
  "0xdac17f958d2ee523a2206206994597c13d831ec7": { symbol: "USDT", decimals: 6, peg: "usd" },
  "0x6b175474e89094c44da98b954eedeac495271d0f": { symbol: "DAI", decimals: 18, peg: "usd" },
  "0x2260fac5e5542a773aa44fbcfedf7c193bc2c599": { symbol: "WBTC", decimals: 8, peg: "btc" },
  // Bybit 해킹 때 함께 빠져나간 토큰. 스테이킹 ETH라 1:1로 근사
  "0xae7ab96520de3a18e5e111b5eaab095312d7fe84": { symbol: "stETH", decimals: 18, peg: "eth" },
  "0xd5f7838f5c461feff7fe49ea5ebaf7728bb0adfa": { symbol: "mETH", decimals: 18, peg: "eth" },
  "0xe6829d9a7ee3040e1276fa75293bde931859e8fa": { symbol: "cmETH", decimals: 18, peg: "eth" },
};

// 송금 한 건이 어떤 토큰인지. external·internal = ETH, erc20은 화이트리스트에 있을 때만 (없으면 null)
export function tokenOf(category: string, contract: string | null): TokenInfo | null {
  if (category !== "erc20") return ETH;
  const key = contract?.toLowerCase();
  return (key && TOKENS[key]) || null;
}
