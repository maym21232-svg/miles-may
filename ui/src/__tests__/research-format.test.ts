import { describe, expect, it } from "vitest";
import { researchValue } from "../research-format";

describe("research summary values", () => {
  it("shows normal ratios in familiar units", () => {
    expect(researchValue("return_on_equity", 0.15)).toBe("15.0%");
    expect(researchValue("price_to_earnings_ratio", 12.5)).toBe("12.5×");
  });

  it("flags extreme ratios for source verification", () => {
    expect(researchValue("return_on_equity", 153.673)).toBe("需核对");
    expect(researchValue("price_to_earnings_ratio", 0.04)).toBe("需核对");
    expect(researchValue("price_to_earnings_ratio", -70)).toBe("不适用");
  });
});
