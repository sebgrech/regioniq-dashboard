"use client"

import { useEffect, useRef, useState, useCallback } from "react"
import { useRouter } from "next/navigation"
import Image from "next/image"
import { ArrowRight } from "lucide-react"
import { cn } from "@/lib/utils"

interface Flowline {
  id: string
  startAnchor: { x: number; y: number }
  endAnchor: { x: number; y: number }
  progress: number
  speed: number
  opacity: number
}

// Predefined anchor coordinates relative to SVG (percentage-based)
const ANCHORS = [
  { x: 42, y: 28 }, // Glasgow
  { x: 50, y: 42 }, // Newcastle
  { x: 55, y: 54 }, // Leeds
  { x: 58, y: 63 }, // Manchester
  { x: 60, y: 70 }, // Birmingham
  { x: 66, y: 82 }, // London
  { x: 52, y: 75 }, // Nottingham
  { x: 56, y: 78 }, // Leicester
  { x: 62, y: 88 }, // Bristol
  { x: 64, y: 90 }, // Cardiff
  { x: 48, y: 50 }, // Sheffield
  { x: 54, y: 58 }, // Liverpool
  { x: 44, y: 32 }, // Edinburgh
  { x: 46, y: 38 }, // Aberdeen
  { x: 68, y: 85 }, // Brighton
  { x: 50, y: 68 }, // Derby
  { x: 58, y: 72 }, // Coventry
  { x: 64, y: 80 }, // Oxford
  { x: 60, y: 76 }, // Northampton
  { x: 66, y: 84 }, // Reading
]

export function HeroLanding() {
  const router = useRouter()
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const containerRef = useRef<HTMLDivElement>(null)
  const [mousePos, setMousePos] = useState({ x: 0, y: 0 })
  const [isTransitioning, setIsTransitioning] = useState(false)
  const flowlinesRef = useRef<Flowline[]>([])
  const animationFrameRef = useRef<number | undefined>(undefined)

  // Initialize flowlines between anchors
  const initializeFlowlines = useCallback(() => {
    const lines: Flowline[] = []
    const numLines = 16

    for (let i = 0; i < numLines; i++) {
      const startAnchor = ANCHORS[Math.floor(Math.random() * ANCHORS.length)]
      let endAnchor = ANCHORS[Math.floor(Math.random() * ANCHORS.length)]
      
      // Ensure start and end are different
      while (endAnchor === startAnchor) {
        endAnchor = ANCHORS[Math.floor(Math.random() * ANCHORS.length)]
      }

      lines.push({
        id: `line-${i}`,
        startAnchor,
        endAnchor,
        progress: Math.random(),
        speed: 0.15 + Math.random() * 0.2,
        opacity: 0.2 + Math.random() * 0.3,
      })
    }

    flowlinesRef.current = lines
  }, [])

  // Draw flowlines animation
  const drawFlowlines = useCallback(() => {
    const canvas = canvasRef.current
    if (!canvas || !containerRef.current) return

    const ctx = canvas.getContext("2d")
    if (!ctx) return

    const rect = containerRef.current.getBoundingClientRect()
    const { width, height } = rect
    
    // Set canvas size
    canvas.width = width
    canvas.height = height

    // Clear canvas
    ctx.clearRect(0, 0, width, height)

    // Parallax offset for flowlines
    const parallaxX = (mousePos.x - 0.5) * 8
    const parallaxY = (mousePos.y - 0.5) * 8

    // Draw flowlines
    flowlinesRef.current.forEach((line) => {
      const startX = (line.startAnchor.x / 100) * width + parallaxX
      const startY = (line.startAnchor.y / 100) * height + parallaxY
      const endX = (line.endAnchor.x / 100) * width + parallaxX
      const endY = (line.endAnchor.y / 100) * height + parallaxY

      const currentX = startX + (endX - startX) * line.progress
      const currentY = startY + (endY - startY) * line.progress

      // Add slight noise jitter
      const jitterX = (Math.random() - 0.5) * 2
      const jitterY = (Math.random() - 0.5) * 2

      // Draw line from start to current position
      ctx.beginPath()
      ctx.moveTo(startX, startY)
      ctx.lineTo(currentX + jitterX, currentY + jitterY)
      
      // Gradient stroke
      const gradient = ctx.createLinearGradient(startX, startY, currentX, currentY)
      gradient.addColorStop(0, `rgba(255, 255, 255, ${line.opacity * 0.3})`)
      gradient.addColorStop(0.5, `rgba(255, 255, 255, ${line.opacity})`)
      gradient.addColorStop(1, `rgba(255, 255, 255, ${line.opacity * 0.3})`)

      ctx.strokeStyle = gradient
      ctx.lineWidth = 1 + Math.random() * 0.5 // 1px to 1.5px
      ctx.stroke()

      // Draw moving dot at current position
      ctx.beginPath()
      ctx.arc(currentX + jitterX, currentY + jitterY, 2, 0, Math.PI * 2)
      ctx.fillStyle = `rgba(255, 255, 255, ${line.opacity * 1.2})`
      ctx.fill()

      // Update progress
      line.progress += line.speed * 0.008
      if (line.progress > 1) {
        line.progress = 0
        // Randomize new destination
        const newEndAnchor = ANCHORS[Math.floor(Math.random() * ANCHORS.length)]
        if (newEndAnchor !== line.startAnchor) {
          line.endAnchor = newEndAnchor
        }
      }
    })

    animationFrameRef.current = requestAnimationFrame(drawFlowlines)
  }, [mousePos])

  // Handle mouse movement for parallax
  const handleMouseMove = useCallback((e: MouseEvent) => {
    if (!containerRef.current) return
    
    const rect = containerRef.current.getBoundingClientRect()
    const x = (e.clientX - rect.left) / rect.width
    const y = (e.clientY - rect.top) / rect.height
    
    setMousePos({ x, y })
  }, [])

  // Handle canvas resize
  const handleResize = useCallback(() => {
    const canvas = canvasRef.current
    if (!canvas || !containerRef.current) return

    const rect = containerRef.current.getBoundingClientRect()
    canvas.width = rect.width
    canvas.height = rect.height
  }, [])

  // Initialize
  useEffect(() => {
    initializeFlowlines()
    handleResize()
    
    window.addEventListener("resize", handleResize)
    window.addEventListener("mousemove", handleMouseMove)

    // Start animation
    drawFlowlines()

    return () => {
      window.removeEventListener("resize", handleResize)
      window.removeEventListener("mousemove", handleMouseMove)
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current)
      }
    }
  }, [initializeFlowlines, handleResize, handleMouseMove, drawFlowlines])

  const handleEnterDashboard = () => {
    setIsTransitioning(true)
    // Smooth fade transition (300ms)
    setTimeout(() => {
      router.push("/dashboard")
    }, 300)
  }

  // Parallax for text content (very subtle)
  const textOffset = {
    x: (mousePos.x - 0.5) * 4,
    y: (mousePos.y - 0.5) * 4,
  }

  return (
    <div
      ref={containerRef}
      className={cn(
        "relative min-h-screen flex items-center justify-end px-12 bg-[#0B0F14] overflow-hidden",
        isTransitioning && "opacity-0 transition-opacity duration-300"
      )}
    >
      {/* Film grain overlay */}
      <div
        className="absolute inset-0 opacity-[0.03] pointer-events-none z-[3]"
        style={{
          backgroundImage: `url("data:image/svg+xml,%3Csvg viewBox='0 0 400 400' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='noiseFilter'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23noiseFilter)'/%3E%3C/svg%3E")`,
          backgroundSize: "200px 200px",
        }}
      />

      {/* UK Map Background - Layer 1 */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none z-[1]">
        <img
          src="/gb.svg"
          alt="UK Map"
          className="absolute left-[-10%] top-[-10%] h-[140vh] opacity-[0.08] blur-lg pointer-events-none"
          style={{
            animation: "fadeIn 0.6s ease-out 0.4s both",
          }}
        />
      </div>

      {/* Flowlines canvas - Layer 2 */}
      <canvas
        ref={canvasRef}
        className="absolute inset-0 z-[2] pointer-events-none"
        style={{
          animation: "fadeIn 0.6s ease-out 0.7s both",
        }}
      />

      {/* Right column content - Layer 3 */}
      <div
        className="relative z-[3] max-w-[520px] text-left"
        style={{
          transform: `translate3d(${textOffset.x}px, ${textOffset.y}px, 0)`,
          transition: "transform 0.1s ease-out",
        }}
      >
        {/* Wordmark + tagline */}
        <div className="relative z-[3]">
          {/* Logo + wordmark row, matching nav style */}
          <div
            className="flex items-center gap-3 mb-4"
            style={{
              animation: "fadeIn 0.6s ease-out 0.9s both",
            }}
          >
            <div className="flex h-12 w-12 items-center justify-center rounded-full border border-white/15 bg-white/5">
              {/* Logo icon */}
              <div className="relative h-8 w-8">
                {/* Light mode logo */}
                <Image
                  src="/x.png"
                  alt="RegionIQ"
                  fill
                  className="object-contain dark:hidden"
                  priority
                />
                {/* Dark mode logo */}
                <Image
                  src="/Frame 11.png"
                  alt="RegionIQ"
                  fill
                  className="object-contain hidden dark:block"
                  priority
                />
              </div>
            </div>
            <span
              className="font-plus-jakarta text-[clamp(28px,3.4vw,40px)] font-bold tracking-tight leading-none bg-gradient-to-r from-white to-white/90 bg-clip-text text-transparent whitespace-nowrap"
              style={{
                fontFamily: "var(--font-plus-jakarta-sans), sans-serif",
              }}
            >
              RegionIQ
            </span>
          </div>

          {/* Tagline – keep light, but aligned left under the wordmark */}
          <p
            className="font-plus-jakarta text-[clamp(14px,1.4vw,18px)] font-normal text-white/70 leading-snug max-w-[360px]"
            style={{
              fontFamily: "var(--font-plus-jakarta-sans), sans-serif",
              animation: "fadeIn 0.5s ease-out 1.1s both",
            }}
          >
            See the Future. Region by Region.
          </p>

          {/* CTA button block */}
          <div className="mt-8">
            <button
              onClick={handleEnterDashboard}
              className={cn(
                "group relative px-8 py-4 rounded-[18px] h-16",
                "bg-white/5 backdrop-blur-xl border border-white/10",
                "text-white font-light",
                "transition-all duration-300",
                "hover:bg-white/10",
                "active:scale-95",
                "focus:outline-none focus:ring-2 focus:ring-white/30 focus:ring-offset-2 focus:ring-offset-[#0B0F14]",
                "flex items-center gap-3"
              )}
              style={{
                animation: "fadeIn 0.5s ease-out 1.3s both",
              }}
            >
              <span>Enter Dashboard</span>
              <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-1" />
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
