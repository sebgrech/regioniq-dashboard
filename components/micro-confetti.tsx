"use client"

import { useEffect, useRef, useCallback } from "react"

// ─────────────────────────────────────────────────────────────────────────────
// MICRO-CONFETTI — Restrained celebration for #1 discoveries
// 
// Bloomberg discipline: 10-15 particles, one metric per session,
// more acknowledgement than celebration. If it feels like Duolingo, 
// we've gone too far.
// ─────────────────────────────────────────────────────────────────────────────

interface Particle {
  x: number
  y: number
  vx: number
  vy: number
  size: number
  color: string
  rotation: number
  rotationSpeed: number
  opacity: number
  life: number
}

// Track which metrics have already celebrated this session
const celebratedMetrics = new Set<string>()

export function useMicroConfetti() {
  const canvasRef = useRef<HTMLCanvasElement | null>(null)
  const particlesRef = useRef<Particle[]>([])
  const animationRef = useRef<number | null>(null)

  // Create or get canvas
  const getCanvas = useCallback(() => {
    if (canvasRef.current) return canvasRef.current
    
    const canvas = document.createElement("canvas")
    canvas.id = "micro-confetti-canvas"
    canvas.style.cssText = `
      position: fixed;
      top: 0;
      left: 0;
      width: 100vw;
      height: 100vh;
      pointer-events: none;
      z-index: 99999;
    `
    document.body.appendChild(canvas)
    
    // Set canvas size
    const resize = () => {
      canvas.width = window.innerWidth
      canvas.height = window.innerHeight
    }
    resize()
    window.addEventListener("resize", resize)
    
    canvasRef.current = canvas
    return canvas
  }, [])

  // Animate particles - burst effect
  const animate = useCallback(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    
    const ctx = canvas.getContext("2d")
    if (!ctx) return
    
    ctx.clearRect(0, 0, canvas.width, canvas.height)
    
    particlesRef.current = particlesRef.current.filter(p => {
      p.x += p.vx
      p.y += p.vy
      p.vy += 0.12 // Gravity
      p.vx *= 0.99 // Air resistance
      p.rotation += p.rotationSpeed
      p.life -= 0.006 // Slower decay = longer visible (~2.5s total)
      p.opacity = Math.min(1, p.life * 2)
      
      if (p.life <= 0) return false
      
      ctx.save()
      ctx.translate(p.x, p.y)
      ctx.rotate(p.rotation)
      ctx.globalAlpha = p.opacity
      ctx.fillStyle = p.color
      
      // Draw small rectangle (confetti piece)
      ctx.fillRect(-p.size / 2, -p.size / 3, p.size, p.size / 1.5)
      
      ctx.restore()
      return true
    })
    
    if (particlesRef.current.length > 0) {
      animationRef.current = requestAnimationFrame(animate)
    } else {
      animationRef.current = null
      // Clean up canvas when done
      if (canvasRef.current && canvasRef.current.parentNode) {
        canvasRef.current.parentNode.removeChild(canvasRef.current)
        canvasRef.current = null
      }
    }
  }, [])

  // Trigger confetti burst with delay
  const celebrate = useCallback((
    metricId: string,
    origin: { x: number; y: number }
  ) => {
    // Only celebrate once per metric per session (Bloomberg discipline)
    if (celebratedMetrics.has(metricId)) return
    celebratedMetrics.add(metricId)
    
    // Delay confetti to let the #1 flag render first
    setTimeout(() => {
      const canvas = getCanvas()
      if (!canvas) return
      
      // Muted, professional colors - not rainbow
      const colors = [
        "#3b82f6", // blue
        "#6366f1", // indigo
        "#8b5cf6", // violet
        "#a855f7", // purple
        "#14b8a6", // teal
      ]
      
      // Create 18 particles in a burst pattern
      const particleCount = 18
      for (let i = 0; i < particleCount; i++) {
        const angle = (Math.PI * 2 * i) / particleCount - Math.PI / 2
        const speed = 4 + Math.random() * 4 // Slightly faster burst
        
        particlesRef.current.push({
          x: origin.x,
          y: origin.y,
          vx: Math.cos(angle) * speed * (0.8 + Math.random() * 0.4),
          vy: Math.sin(angle) * speed * 0.8 - 3, // Bias upward
          size: 5 + Math.random() * 5, // Slightly larger particles
          color: colors[Math.floor(Math.random() * colors.length)],
          rotation: Math.random() * Math.PI * 2,
          rotationSpeed: (Math.random() - 0.5) * 0.2,
          opacity: 1,
          life: 1.3, // Longer life for more visibility
        })
      }
      
      // Start animation if not already running
      if (!animationRef.current) {
        animate()
      }
    }, 600) // 600ms delay - lets the #1 flag animate in first
  }, [getCanvas, animate])

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (animationRef.current) {
        cancelAnimationFrame(animationRef.current)
      }
      if (canvasRef.current && canvasRef.current.parentNode) {
        canvasRef.current.parentNode.removeChild(canvasRef.current)
      }
    }
  }, [])

  return { celebrate }
}

// Helper to check if a rank is #1 and get the origin point
export function checkForCelebration(
  metricId: string,
  rank: number | null | undefined,
  elementRef: HTMLElement | null
): { shouldCelebrate: boolean; origin: { x: number; y: number } } | null {
  if (rank !== 1 || !elementRef) return null
  if (celebratedMetrics.has(metricId)) return null
  
  const rect = elementRef.getBoundingClientRect()
  return {
    shouldCelebrate: true,
    origin: {
      x: rect.left + rect.width / 2,
      y: rect.top + rect.height / 2,
    }
  }
}

// Reset celebrations (e.g., on region change)
export function resetCelebrations() {
  celebratedMetrics.clear()
}

