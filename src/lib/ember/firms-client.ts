// firms-client.ts — NASA FIRMS NRT API client for VIIRS fire detections (issue #95).
// Stateless pure function — takes API key and bounding box, returns filtered detections.

export interface BoundingBox {
  west: number;
  south: number;
  east: number;
  north: number;
}

// Shasta County, CA hardcoded bounding box (named constant per spec).
export const SHASTA_COUNTY_BBOX: BoundingBox = {
  west: -123.0,
  south: 40.2,
  east: -121.3,
  north: 41.2,
};

export interface FirmsDetection {
  lat: number;
  lng: number;
  frp: number;
  confidence: string;
  detectedAt: Date;
}

const FIRMS_BASE_URL = "https://firms.modaps.eosdis.nasa.gov/api/area/csv";
const SOURCE = "VIIRS_SNPP_NRT";
const DAY_RANGE = 1;
const FETCH_TIMEOUT_MS = 20_000;

function parseViirsCsv(csv: string): FirmsDetection[] {
  const lines = csv.trim().split("\n");
  if (lines.length < 2) return [];

  const header = lines[0].split(",");
  const latIdx = header.indexOf("latitude");
  const lngIdx = header.indexOf("longitude");
  const frpIdx = header.indexOf("frp");
  const confIdx = header.indexOf("confidence");
  const dateIdx = header.indexOf("acq_date");
  const timeIdx = header.indexOf("acq_time");

  if (latIdx === -1 || lngIdx === -1 || frpIdx === -1 || confIdx === -1) return [];

  const detections: FirmsDetection[] = [];

  for (let i = 1; i < lines.length; i++) {
    const line = lines[i].trim();
    if (!line) continue;
    const cols = line.split(",");
    if (cols.length < header.length) continue;

    const lat = parseFloat(cols[latIdx]);
    const lng = parseFloat(cols[lngIdx]);
    const frp = parseFloat(cols[frpIdx]);
    const confidence = cols[confIdx].trim();

    if (isNaN(lat) || isNaN(lng) || isNaN(frp)) continue;

    let detectedAt = new Date();
    if (dateIdx !== -1 && timeIdx !== -1) {
      const dateStr = cols[dateIdx].trim();
      const timeStr = cols[timeIdx].trim().padStart(4, "0");
      const parsed = new Date(`${dateStr}T${timeStr.slice(0, 2)}:${timeStr.slice(2)}:00Z`);
      if (!isNaN(parsed.getTime())) detectedAt = parsed;
    }

    detections.push({ lat, lng, frp, confidence, detectedAt });
  }

  return detections;
}

// VIIRS confidence: 'l' = low, 'n' = nominal, 'h' = high.
// Exclude 'l' — low-confidence detections are likely clouds or instrument noise.
// Design intent: false alarms damage trust more than missed fires (see MEMORY.md).
export function meetsConfidenceThreshold(det: FirmsDetection): boolean {
  return det.confidence === "n" || det.confidence === "h";
}

export function isWithinBbox(det: FirmsDetection, bbox: BoundingBox): boolean {
  return (
    det.lat >= bbox.south &&
    det.lat <= bbox.north &&
    det.lng >= bbox.west &&
    det.lng <= bbox.east
  );
}

export async function fetchFirmsDetections(
  apiKey: string,
  bbox: BoundingBox = SHASTA_COUNTY_BBOX
): Promise<FirmsDetection[]> {
  const area = `${bbox.west},${bbox.south},${bbox.east},${bbox.north}`;
  const url = `${FIRMS_BASE_URL}/${apiKey}/${SOURCE}/${area}/${DAY_RANGE}`;

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);

  try {
    const res = await fetch(url, { signal: controller.signal });
    if (!res.ok) throw new Error(`FIRMS API returned HTTP ${res.status}`);

    const csv = await res.text();
    const all = parseViirsCsv(csv);

    return all.filter(
      (det) => isWithinBbox(det, bbox) && meetsConfidenceThreshold(det)
    );
  } finally {
    clearTimeout(timeout);
  }
}
