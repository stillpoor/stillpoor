import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "StillPoor",
    short_name: "StillPoor",
    description: "The Bitcoin community pixel board.",
    start_url: "/",
    display: "standalone",
    background_color: "#e9e9e9",
    theme_color: "#0f172b",
    icons: [
      {
        src: "/android-chrome-192x192.png",
        sizes: "192x192",
        type: "image/png",
      },
      {
        src: "/android-chrome-512x512.png",
        sizes: "512x512",
        type: "image/png",
      },
    ],
  };
}