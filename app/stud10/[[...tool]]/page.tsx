"use client";

import dynamic from "next/dynamic";
import config from "@/sanity.config"; // ← keep whatever config import your file already uses

const NextStudio = dynamic(() => import("next-sanity/studio").then((m) => m.NextStudio), {
  ssr: false,
  loading: () => (
    <div style={{ display: "flex", alignItems: "center", justifyContent: "center", minHeight: "60vh", fontFamily: "sans-serif", fontSize: 12, color: "#6b7280" }}>
      Loading Studio…
    </div>
  ),
});

export default function StudioPage() {
  return <NextStudio config={config} />;
}
