import { ImageResponse } from "next/og";
import { getSettings } from "@/lib/settings";

export const alt = "Sabetha Golf Club";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

export default async function OpengraphImage() {
  const { club, course } = await getSettings();

  return new ImageResponse(
    <div
      style={{
        width: "100%",
        height: "100%",
        display: "flex",
        flexDirection: "column",
        justifyContent: "center",
        padding: 80,
        background: "linear-gradient(180deg, #14532d 0%, #166534 100%)",
        color: "white",
      }}
    >
      <div style={{ fontSize: 32, color: "#bbf7d0", letterSpacing: 2 }}>
        {`${club.city.toUpperCase()}, ${club.state} · SINCE ${course.built}`}
      </div>
      <div style={{ fontSize: 96, fontWeight: 700, marginTop: 12 }}>
        {club.name}
      </div>
      <div style={{ fontSize: 40, marginTop: 24, color: "#f0fdf4" }}>
        {`${course.holes} holes · ${course.yards.toLocaleString("en-US")} yards · Built ${course.built}`}
      </div>
    </div>,
    size,
  );
}
