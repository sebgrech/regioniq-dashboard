import { downloadDataUrl } from "@/lib/export/download"

export type ExportElementPngOptions = {
  node: HTMLElement
  filename: string
  /** Solid background to avoid transparent PNGs (especially in dark mode). */
  backgroundColor?: string
  /** Default 2 for sharper exports. */
  pixelRatio?: number
}

/**
 * Export an on-screen DOM node as a PNG file.
 *
 * Uses `html-to-image` via dynamic import to avoid SSR issues and reduce bundle impact.
 * Also sets `data-riq-exporting="true"` on the node during capture so CSS can hide tooltips.
 */
export async function exportElementPng({
  node,
  filename,
  backgroundColor = "#ffffff",
  pixelRatio = 2,
}: ExportElementPngOptions) {
  if (!node) throw new Error("Missing node for PNG export")

  const prev = node.getAttribute("data-riq-exporting")
  node.setAttribute("data-riq-exporting", "true")

  try {
    const mod = await import("html-to-image")
    const toPng: (node: HTMLElement, options?: any) => Promise<string> =
      (mod as any).toPng ?? (mod as any).default?.toPng

    if (typeof toPng !== "function") {
      throw new Error("html-to-image: toPng not available")
    }

    const dataUrl = await toPng(node, {
      cacheBust: true,
      backgroundColor,
      pixelRatio,
    })

    downloadDataUrl(dataUrl, filename)
  } finally {
    if (prev == null) node.removeAttribute("data-riq-exporting")
    else node.setAttribute("data-riq-exporting", prev)
  }
}


