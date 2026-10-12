import { useEffect, useState } from "react";
import { loadResearchNote, saveResearchNote } from "../research-notes";

export function ResearchNotes({ symbol }: { symbol: string }) {
  const [note, setNote] = useState(() => loadResearchNote(symbol));
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    setNote(loadResearchNote(symbol));
    setFailed(false);
  }, [symbol]);

  return (
    <details className="research-notes">
      <summary>研究笔记{note ? " · 已记录" : ""}</summary>
      <label htmlFor={`research-note-${symbol}`}>核验要点与待查问题</label>
      <textarea
        id={`research-note-${symbol}`}
        value={note}
        maxLength={5000}
        rows={5}
        placeholder="业务模式、竞争优势、风险、财报疑点…"
        onChange={(event) => {
          const next = event.target.value;
          setNote(next);
          setFailed(!saveResearchNote(symbol, next));
        }}
      />
      {failed ? <p role="alert">保存失败，请检查浏览器存储设置。</p>
        : <p>自动保存在当前浏览器，不会同步到其他设备。</p>}
    </details>
  );
}
