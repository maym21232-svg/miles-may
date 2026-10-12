// FR-007 — searchable column picker over the snapshot's ~200 columns.

import { useEffect, useMemo, useRef, useState } from "react";
import { researchFieldLabel } from "../research-labels";

interface Props {
  available: string[];
  visible: string[];
  onChange: (next: string[]) => void;
}

export function ColumnPicker({ available, visible, onChange }: Props) {
  const [open, setOpen] = useState(false);
  const [filter, setFilter] = useState("");
  const rootRef = useRef<HTMLDivElement>(null);
  const shown = useMemo(
    () => available.filter((c) => `${c} ${researchFieldLabel(c)}`.toLowerCase().includes(filter.toLowerCase())),
    [available, filter],
  );

  useEffect(() => {
    if (!open) return;
    const onPointerDown = (event: PointerEvent) => {
      if (rootRef.current && !rootRef.current.contains(event.target as Node)) setOpen(false);
    };
    document.addEventListener("pointerdown", onPointerDown);
    return () => document.removeEventListener("pointerdown", onPointerDown);
  }, [open]);

  return (
    <div
      className="picker"
      ref={rootRef}
      onKeyDown={(event) => {
        if (event.key === "Escape") setOpen(false);
      }}
    >
      <button onClick={() => setOpen((v) => !v)} aria-expanded={open}>
        显示指标（{visible.length}）
      </button>
      {open && (
        <div className="picker-menu">
          <input
            aria-label="搜索指标"
            className="picker-filter"
            placeholder="搜索指标…"
            autoFocus
            value={filter}
            onChange={(event) => setFilter(event.target.value)}
          />
          {shown.map((column) => (
            <label key={column}>
              <input
                type="checkbox"
                checked={visible.includes(column)}
                onChange={(event) =>
                  onChange(
                    event.target.checked
                      ? [...visible, column]
                      : visible.filter((c) => c !== column),
                  )
                }
              />{" "}
              {researchFieldLabel(column)}
            </label>
          ))}
        </div>
      )}
    </div>
  );
}
