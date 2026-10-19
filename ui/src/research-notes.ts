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

export function loadAllResearchNotes(): Record<string, string> {
  const notes: Record<string, string> = {};
  try {
    for (let index = 0; index < localStorage.length; index++) {
      const key = localStorage.key(index);
      if (!key?.startsWith(PREFIX)) continue;
      const symbol = key.slice(PREFIX.length);
      if (!/^[A-Z0-9.^-]{1,20}$/.test(symbol)) continue;
      const note = localStorage.getItem(key);
      if (note) notes[symbol] = note.slice(0, 5000);
    }
  } catch {
    return notes;
  }
  return notes;
}
