import { NextRequest, NextResponse } from "next/server"
import { z } from "zod"
import PptxGenJS from "pptxgenjs"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

const BodySchema = z.object({
  result: z.object({
    level: z.enum(["LAD", "MSOA"]).optional().default("LAD"),
    population: z.number(),
    gdhi_total: z.number(),
    employment: z.number(),
    gva: z.number().optional().default(0),
    average_income: z.number().optional().default(0),
    regions_used: z.number(),
    year: z.number(),
    scenario: z.string(),
  }),
  // Optional slide title (lets callers match the "Victoria Office Catchment" style)
  title: z.string().optional(),
})

function formatCompact(n: number): string {
  if (n >= 1e9) return `${(n / 1e9).toFixed(2)}B`
  if (n >= 1e6) return `${(n / 1e6).toFixed(2)}M`
  if (n >= 1e3) return `${(n / 1e3).toFixed(1)}K`
  return n.toLocaleString()
}

// NOTE: We intentionally avoid embedding SVG images in PPTX because PowerPoint can drop them on import.
// Icons are drawn using native PPT shapes/text instead (see addMetricCard).

export async function POST(req: NextRequest) {
  try {
    const body = BodySchema.parse(await req.json())
    const { result } = body

    const pptx = new PptxGenJS()
    pptx.layout = "LAYOUT_WIDE" // 16:9
    pptx.author = "RegionIQ"
    pptx.company = "RegionIQ"
    pptx.subject = "Catchment summary"
    pptx.title = body.title ?? "Catchment Summary"

    const fontFace = "Plus Jakarta Sans"
    // Note: PowerPoint will use this font if installed on the viewer's machine; otherwise it falls back.
    ;(pptx as any).theme = { headFontFace: fontFace, bodyFontFace: fontFace, lang: "en-GB" }

    const slide = pptx.addSlide()

    // Theme: dark background + neon-ish accent borders (matches the vibe of your example).
    const bg = "0B1220"
    const cardFill = "0F1B2D"
    slide.background = { color: bg }

    // Slide geometry (inches) for LAYOUT_WIDE: 13.333 x 7.5
    const slideW = 13.333
    const slideH = 7.5

    const marginX = 1.0
    const marginY = 1.2
    const gapX = 0.7
    const gapY = 0.7
    const cardW = (slideW - marginX * 2 - gapX) / 2
    const cardH = (slideH - marginY * 2 - gapY) / 2

    const titleText = body.title?.trim()
    if (titleText) {
      slide.addText(titleText, {
        x: marginX,
        y: 0.45,
        w: slideW - marginX * 2,
        h: 0.6,
        fontFace,
        fontSize: 30,
        bold: true,
        color: "FFFFFF",
      })
    }

    type CardSpec = {
      title: string
      value: string
      subtitle?: string
      accent: string
      icon: "users" | "pound" | "briefcase" | "mappin"
    }

    const isMSOA = result.level === "MSOA"
    const regionLabel = isMSOA ? "Neighbourhoods" : "Local Authorities"
    const regionValue = `${result.regions_used} ${isMSOA ? "neighbourhoods" : "local authorities"}`

    const cards: CardSpec[] = [
      {
        title: "Population",
        value: `${formatCompact(result.population)} people`,
        accent: "2DD4BF",
        icon: "users",
      },
      isMSOA
        ? {
            title: "Avg Household Income",
            value: `\u00A3${formatCompact(result.average_income)}`,
            subtitle: "Population-weighted average",
            accent: "2DD4BF",
            icon: "pound",
          }
        : {
            title: "Household Income",
            value: `\u00A3${formatCompact(result.gdhi_total)}`,
            subtitle: "Total GDHI",
            accent: "2DD4BF",
            icon: "pound",
          },
      {
        title: "Employment",
        value: `${formatCompact(result.employment)} jobs`,
        accent: "2DD4BF",
        icon: "briefcase",
      },
      isMSOA
        ? {
            title: "GVA",
            value: `\u00A3${formatCompact(result.gva * 1e6)}`,
            subtitle: "Gross Value Added",
            accent: "2DD4BF",
            icon: "mappin",
          }
        : {
            title: regionLabel,
            value: regionValue,
            subtitle: "Contributing to estimate",
            accent: "2DD4BF",
            icon: "mappin",
          },
    ]

    function addMetricCard(spec: CardSpec, x: number, y: number) {
      // Card container
      slide.addShape("roundRect", {
        x,
        y,
        w: cardW,
        h: cardH,
        fill: { color: cardFill },
        line: { color: spec.accent, width: 2 },
        rectRadius: 0.18,
      })

      // Title
      slide.addText(spec.title, {
        x: x + 0.35,
        y: y + 0.35,
        w: cardW - 1.1,
        h: 0.35,
        fontFace,
        fontSize: 16,
        color: "FFFFFF",
      })

      // Value
      slide.addText(spec.value, {
        x: x + 0.35,
        y: y + 0.8,
        w: cardW - 0.7,
        h: 0.8,
        fontFace,
        fontSize: 32,
        bold: true,
        color: "FFFFFF",
      })

      // Subtitle (optional)
      if (spec.subtitle) {
        slide.addText(spec.subtitle, {
          x: x + 0.35,
          y: y + 1.55,
          w: cardW - 0.7,
          h: 0.3,
          fontFace,
          fontSize: 13,
          color: "C7D2FE",
        })
      }

      // Icon container (top-right)
      const bubble = 0.55
      const bubbleX = x + cardW - bubble - 0.35
      const bubbleY = y + 0.33
      slide.addShape("ellipse", {
        x: bubbleX,
        y: bubbleY,
        w: bubble,
        h: bubble,
        fill: { color: cardFill },
        line: { color: spec.accent, width: 2 },
      })

      // Icon (native PPT shapes/text) — more reliable than SVG images in PowerPoint.
      const ix = bubbleX + 0.12
      const iy = bubbleY + 0.12
      const iw = bubble - 0.24
      const ih = bubble - 0.24

      const stroke = { color: spec.accent, width: 1.5 }
      const transparentFill = { color: cardFill, transparency: 100 }

      if (spec.icon === "pound") {
        slide.addText("£", {
          x: ix,
          y: iy - 0.02,
          w: iw,
          h: ih,
          fontFace,
          fontSize: 18,
          bold: true,
          color: spec.accent,
          align: "center",
          valign: "mid",
        })
      } else if (spec.icon === "briefcase") {
        // Briefcase outline
        slide.addShape("rect", {
          x: ix,
          y: iy + 0.05,
          w: iw,
          h: ih - 0.1,
          fill: transparentFill,
          line: stroke,
        })
        // Handle
        slide.addShape("roundRect", {
          x: ix + iw * 0.28,
          y: iy - 0.02,
          w: iw * 0.44,
          h: ih * 0.28,
          fill: transparentFill,
          line: stroke,
          rectRadius: 0.5,
        })
        // Inner divider (thin rectangle; avoids 'line' shape XML issues)
        slide.addShape("rect", {
          x: ix + 0.02,
          y: iy + ih * 0.49,
          w: iw - 0.04,
          h: 0.03,
          fill: { color: spec.accent, transparency: 35 },
          line: { color: spec.accent, width: 0 },
        })
      } else if (spec.icon === "users") {
        // Two heads
        slide.addShape("ellipse", {
          x: ix + iw * 0.08,
          y: iy + ih * 0.12,
          w: iw * 0.42,
          h: ih * 0.42,
          fill: transparentFill,
          line: stroke,
        })
        slide.addShape("ellipse", {
          x: ix + iw * 0.46,
          y: iy + ih * 0.18,
          w: iw * 0.36,
          h: ih * 0.36,
          fill: transparentFill,
          line: stroke,
        })
        // Simple shoulders blocks
        slide.addShape("roundRect", {
          x: ix + iw * 0.05,
          y: iy + ih * 0.56,
          w: iw * 0.55,
          h: ih * 0.28,
          fill: transparentFill,
          line: stroke,
          rectRadius: 0.5,
        })
        slide.addShape("roundRect", {
          x: ix + iw * 0.48,
          y: iy + ih * 0.6,
          w: iw * 0.47,
          h: ih * 0.22,
          fill: transparentFill,
          line: stroke,
          rectRadius: 0.5,
        })
      } else if (spec.icon === "mappin") {
        // Circle at top
        slide.addShape("ellipse", {
          x: ix + iw * 0.25,
          y: iy + ih * 0.08,
          w: iw * 0.5,
          h: ih * 0.5,
          fill: transparentFill,
          line: stroke,
        })
        // Pin point (triangle; avoids 'line' shape XML issues)
        slide.addShape("triangle", {
          x: ix + iw * 0.34,
          y: iy + ih * 0.52,
          w: iw * 0.32,
          h: ih * 0.44,
          rotate: 180,
          fill: transparentFill,
          line: stroke,
        })
        // Inner dot
        slide.addShape("ellipse", {
          x: ix + iw * 0.42,
          y: iy + ih * 0.25,
          w: iw * 0.16,
          h: ih * 0.16,
          fill: transparentFill,
          line: stroke,
        })
      }
    }

    const gridTop = titleText ? 1.35 : marginY
    addMetricCard(cards[0], marginX, gridTop)
    addMetricCard(cards[1], marginX + cardW + gapX, gridTop)
    addMetricCard(cards[2], marginX, gridTop + cardH + gapY)
    addMetricCard(cards[3], marginX + cardW + gapX, gridTop + cardH + gapY)

    const out = await pptx.write({ outputType: "nodebuffer" })
    const buffer = Buffer.isBuffer(out) ? out : Buffer.from(out as any)
    const filename = `regioniq_catchment_summary_${result.year}_${result.scenario}_${new Date().toISOString().slice(0, 10)}.pptx`

    return new NextResponse(buffer as any, {
      headers: {
        "Content-Type":
          "application/vnd.openxmlformats-officedocument.presentationml.presentation",
        "Content-Disposition": `attachment; filename=\"${filename}\"`,
        "Cache-Control": "no-store",
      },
    })
  } catch (err: any) {
    console.error("Catchment PPTX export error:", err)
    return NextResponse.json({ error: err?.message || "Export failed" }, { status: 400 })
  }
}


