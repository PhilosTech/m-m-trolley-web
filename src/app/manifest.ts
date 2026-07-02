import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Trolley Stand Schedule",
    short_name: "Trolley Stand",
    description:
      "Half Marathon Trolley Campaign — trolley stand schedule and volunteer shift sign-up",
    start_url: "/",
    display: "standalone",
    background_color: "#1a1a1c",
    theme_color: "#1a1a1c",
    icons: [
      {
        src: "/icon-192x192.png",
        sizes: "192x192",
        type: "image/png",
      },
      {
        src: "/icon-512x512.png",
        sizes: "512x512",
        type: "image/png",
      },
    ],
  };
}
