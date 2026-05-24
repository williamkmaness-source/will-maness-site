// cluster-engine.ts — Groups FIRMS detections within 2km into fire clusters (issue #95).
// Stateless pure function — no side effects.

import type { FirmsDetection } from "./firms-client";

export interface FireClusterInput {
  lat: number;
  lng: number;
  frp: number;
  detectionCount: number;
  detectedAt: Date;
}

const CLUSTER_RADIUS_KM = 2;

function haversineKm(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const R = 6371;
  const φ1 = (lat1 * Math.PI) / 180;
  const φ2 = (lat2 * Math.PI) / 180;
  const Δφ = ((lat2 - lat1) * Math.PI) / 180;
  const Δλ = ((lng2 - lng1) * Math.PI) / 180;
  const a =
    Math.sin(Δφ / 2) ** 2 + Math.cos(φ1) * Math.cos(φ2) * Math.sin(Δλ / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

export function clusterDetections(detections: FirmsDetection[]): FireClusterInput[] {
  const groups: {
    lats: number[];
    lngs: number[];
    frpTotal: number;
    detectedAt: Date;
  }[] = [];

  for (const det of detections) {
    let matched = false;

    for (const g of groups) {
      const centLat = g.lats.reduce((a, b) => a + b, 0) / g.lats.length;
      const centLng = g.lngs.reduce((a, b) => a + b, 0) / g.lngs.length;

      if (haversineKm(det.lat, det.lng, centLat, centLng) <= CLUSTER_RADIUS_KM) {
        g.lats.push(det.lat);
        g.lngs.push(det.lng);
        g.frpTotal += det.frp;
        if (det.detectedAt > g.detectedAt) g.detectedAt = det.detectedAt;
        matched = true;
        break;
      }
    }

    if (!matched) {
      groups.push({
        lats: [det.lat],
        lngs: [det.lng],
        frpTotal: det.frp,
        detectedAt: det.detectedAt,
      });
    }
  }

  return groups.map((g) => ({
    lat: g.lats.reduce((a, b) => a + b, 0) / g.lats.length,
    lng: g.lngs.reduce((a, b) => a + b, 0) / g.lngs.length,
    frp: g.frpTotal,
    detectionCount: g.lats.length,
    detectedAt: g.detectedAt,
  }));
}
