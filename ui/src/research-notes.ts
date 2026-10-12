const PREFIX = "crible-us-research-note-v1:";

export function loadResearchNote(symbol: string): string {
  try {
    return localStorage.getItem(PREFIX + symbol) ?? "";
  } catch {
    return "";
  }
}

export function saveResearchNote(symbol: string, note: string): boolean {
  try {
    localStorage.setItem(PREFIX + symbol, note.slice(0, 5000));
    return true;
  } catch {
    return false;
  }
}
