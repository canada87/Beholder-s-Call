import { MetadataRoute } from "next"

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Beholder's Call",
    short_name: "Beholder",
    description: "Organizzatore sessioni D&D",
    start_url: "/",
    display: "standalone",
    background_color: "#111827",
    theme_color: "#7c3aed",
    orientation: "portrait",
    icons: [
      {
        src: "/icon",
        sizes: "512x512",
        type: "image/png",
        purpose: "any",
      },
      {
        src: "/icon",
        sizes: "512x512",
        type: "image/png",
        purpose: "maskable",
      },
    ],
  }
}
