import { getAddress, isAddress } from "viem";

export type ParsedInput =
  | { kind: "address"; address: string }
  | { kind: "ens"; name: string }
  | { kind: "invalid"; reason: "format" | "checksum" };

const HEX_ADDRESS = /^0x[0-9a-fA-F]{40}$/;
const ENS_NAME = /^[^\s/]+\.eth$/i;

// 내부 저장·비교는 소문자. getAddress()는 체크섬 오타를 조용히 고쳐 버리므로
// 대소문자가 섞인 주소만 isAddress()(strict)로 체크섬을 확인
// (전부 소문자·전부 대문자는 체크섬이 없는 주소라 그대로 통과)
export function parseInput(input: string): ParsedInput {
  const value = input.trim();
  if (HEX_ADDRESS.test(value)) {
    const body = value.slice(2);
    const mixedCase = /[a-f]/.test(body) && /[A-F]/.test(body);
    if (mixedCase && !isAddress(value)) {
      return { kind: "invalid", reason: "checksum" };
    }
    return { kind: "address", address: value.toLowerCase() };
  }
  if (ENS_NAME.test(value)) return { kind: "ens", name: value };
  return { kind: "invalid", reason: "format" };
}

// 화면 표시용 체크섬 주소
export function toChecksum(address: string) {
  return getAddress(address);
}
