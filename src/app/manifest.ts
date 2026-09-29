import type { MetadataRoute } from "next";
import { PRODUCT_NAME } from "@/lib/constants";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: PRODUCT_NAME,
    short_name: "Malek POS",
    description: "Point of sale, stock, purchasing and licensing for retail shops.",
    start_url: "/",
    display: "standalone",
    background_color: "#F2F5FB",
    theme_color: "#0C1A3D",
    icons: [{ src: "/icon.png", sizes: "512x512", type: "image/png" }, { src: "/apple-icon.png", sizes: "180x180", type: "image/png" }],
  };
}
