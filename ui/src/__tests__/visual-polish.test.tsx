import { render } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { ResultsGrid } from "../components/ResultsGrid";

describe("mobile score indicator", () => {
  it("keeps the numeric rank and clamps its decorative meter", () => {
    const { container } = render(<ResultsGrid
      rows={[{ symbol: "AAA", name: "Example", composite_rank: 120 }]}
      columns={["symbol", "name", "composite_rank"]}
      onSelect={() => {}}
    />);
    expect(container.querySelector(".mobile-score")?.textContent).toContain("120.0");
    expect((container.querySelector(".mobile-score-track > span") as HTMLElement).style.width).toBe("100%");
  });
});
