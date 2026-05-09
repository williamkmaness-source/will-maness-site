// app/opengraph-image.tsx — OG image for the homepage.
// Uses next/og ImageResponse. Satori (the renderer) requires explicit display:flex
// on every div with more than one child — unlike the browser, it has no implicit block layout.

import { ImageResponse } from "next/og";

export const runtime = "edge";
export const alt = "Will Maness — product strategy and engineering";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

export default function Image() {
  return new ImageResponse(
    (
      <div
        style={{
          background: "#F7F3EC",
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          justifyContent: "space-between",
          padding: "72px 80px",
          fontFamily: "Georgia, serif",
        }}
      >
        <div
          style={{
            fontSize: 18,
            color: "#6B665B",
            letterSpacing: "0.06em",
            fontFamily: "monospace",
          }}
        >
          willmaness.com
        </div>

        <div style={{ display: "flex", flexDirection: "column" }}>
          <div
            style={{
              fontSize: 52,
              fontWeight: 500,
              color: "#1F1E1A",
              lineHeight: 1.15,
              letterSpacing: "-0.015em",
              marginBottom: 24,
              maxWidth: 900,
            }}
          >
            Product strategy and engineering
            <span style={{ color: "#2D4A3E" }}> in the AI-and-data stack.</span>
          </div>
          <div style={{ fontSize: 20, color: "#6B665B", lineHeight: 1.5 }}>
            Work, writing, and things I&apos;m thinking about.
          </div>
        </div>

        <div
          style={{
            fontSize: 16,
            color: "#6B665B",
            fontFamily: "monospace",
            display: "flex",
            alignItems: "center",
            gap: 10,
          }}
        >
          <div
            style={{
              width: 7,
              height: 7,
              borderRadius: "50%",
              background: "#B85C38",
            }}
          />
          <span>Will Maness · Boston</span>
        </div>
      </div>
    ),
    size
  );
}
