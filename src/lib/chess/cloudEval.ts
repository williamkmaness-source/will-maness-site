export type CloudEvalPv = {
  moves: string; // space-separated UCI moves
  cp?: number;   // centipawns from side-to-move perspective
  mate?: number; // moves to mate (positive = current side wins)
};

export type CloudEvalResult = {
  fen: string;
  pvs: CloudEvalPv[];
  depth: number;
  knodes?: number;
};

const cache = new Map<string, CloudEvalResult | null>();

export async function fetchCloudEval(
  fen: string,
  signal?: AbortSignal,
): Promise<CloudEvalResult | null> {
  if (cache.has(fen)) return cache.get(fen)!;

  try {
    const url = `https://lichess.org/api/cloud-eval?fen=${encodeURIComponent(fen)}&multiPv=5`;
    const res = await fetch(url, { signal });
    if (!res.ok) {
      cache.set(fen, null);
      return null;
    }
    const data = (await res.json()) as CloudEvalResult;
    cache.set(fen, data);
    return data;
  } catch {
    return null;
  }
}
