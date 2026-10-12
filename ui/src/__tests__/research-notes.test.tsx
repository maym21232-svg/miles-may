import { fireEvent, render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it } from "vitest";
import { ResearchNotes } from "../components/ResearchNotes";
import { loadResearchNote } from "../research-notes";

beforeEach(() => localStorage.clear());

describe("local research notes", () => {
  it("saves a note for one company and restores it", () => {
    const { unmount } = render(<ResearchNotes symbol="AAPL" />);
    fireEvent.click(screen.getByText("研究笔记"));
    fireEvent.change(screen.getByLabelText("核验要点与待查问题"), { target: { value: "核对现金流" } });
    expect(loadResearchNote("AAPL")).toBe("核对现金流");
    unmount();
    render(<ResearchNotes symbol="AAPL" />);
    expect(screen.getByText("研究笔记 · 已记录")).toBeInTheDocument();
    expect(loadResearchNote("MSFT")).toBe("");
  });

  it("does not transfer text when the selected symbol changes", () => {
    const { rerender } = render(<ResearchNotes symbol="AAPL" />);
    fireEvent.click(screen.getByText("研究笔记"));
    fireEvent.change(screen.getByLabelText("核验要点与待查问题"), { target: { value: "苹果笔记" } });
    rerender(<ResearchNotes symbol="MSFT" />);
    expect(screen.getByLabelText("核验要点与待查问题")).toHaveValue("");
  });
});
