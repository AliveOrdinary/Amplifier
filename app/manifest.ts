import type { MetadataRoute } from "next";

/** Lets the studio be installed on a phone and receive images from the share sheet (Android). */
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Amplifier Studio",
    short_name: "Amplifier",
    start_url: "/studio/library",
    scope: "/",
    display: "standalone",
    background_color: "#121211",
    theme_color: "#121211",
    icons: [
      { src: "/icons/icon-192.png", sizes: "192x192", type: "image/png" },
      { src: "/icons/icon-512.png", sizes: "512x512", type: "image/png" },
      { src: "/icons/icon-maskable-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
    ],
    share_target: {
      action: "/studio/share",
      method: "post",
      enctype: "multipart/form-data",
      params: {
        title: "title",
        text: "text",
        url: "url",
        files: [{ name: "file", accept: ["image/*"] }],
      },
    },
  } as MetadataRoute.Manifest;
}
