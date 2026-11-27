import { describe, expect, test } from "vitest";
import { divideRoundHalfUp, formatUsd, parseUsd } from "./money";

describe("parseUsd", () => {
  test("parses whole dollars to cents", () => {
    expect(parseUsd("2400")).toEqual({ ok: true, cents: 240_000 });
  });

  test("parses one decimal digit", () => {
    expect(parseUsd("2400.5")).toEqual({ ok: true, cents: 240_050 });
  });

  test("parses grouped dollars and a dollar sign", () => {
    expect(parseUsd("$2,400.50")).toEqual({ ok: true, cents: 240_050 });
  });

  test("treats blank input as empty rather than zero", () => {
    expect(parseUsd("")).toEqual({ ok: false, reason: "empty" });
    expect(parseUsd("   ")).toEqual({ ok: false, reason: "empty" });
    expect(parseUsd(undefined)).toEqual({ ok: false, reason: "empty" });
  });

  test("rejects words, extra decimals, and negative amounts", () => {
    expect(parseUsd("abc")).toEqual({ ok: false, reason: "invalid" });
    expect(parseUsd("12.345")).toEqual({ ok: false, reason: "invalid" });
    expect(parseUsd("-1")).toEqual({ ok: false, reason: "invalid" });
  });
});

describe("formatUsd", () => {
  test("formats even dollars without cents", () => {
    expect(formatUsd(520_000)).toBe("$5,200");
    expect(formatUsd(0)).toBe("$0");
  });

  test("keeps a non-zero cent remainder", () => {
    expect(formatUsd(520_050)).toBe("$5,200.50");
  });

  test("formats a negative amount with a leading minus", () => {
    expect(formatUsd(-70_000)).toBe("-$700");
  });
});

describe("divideRoundHalfUp", () => {
  test("rounds a remainder of 10/12 up to the next cent", () => {
    expect(divideRoundHalfUp(2_600_026, 12)).toBe(216_669);
  });
});
