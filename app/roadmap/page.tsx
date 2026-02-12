import { DataRoadmap } from "@/components/data-roadmap"
import Image from "next/image"
import Link from "next/link"

export default function RoadmapPage() {
  return (
    <div className="dark relative min-h-screen bg-[hsl(220,48%,9%)] text-white overflow-hidden">
      {/* ── Aurora background (matches login page) ──────────────────────── */}
      <div className="fixed inset-0 pointer-events-none z-0">
        <div className="absolute inset-0 opacity-40">
          <div className="absolute top-0 -left-1/4 w-[150%] h-full bg-gradient-to-br from-blue-500/30 via-transparent to-transparent blur-3xl animate-aurora-slow-1" />
          <div className="absolute top-0 left-1/3 w-full h-full bg-gradient-to-br from-blue-500/30 via-cyan-500/20 to-transparent blur-3xl animate-aurora-slow-2" />
          <div className="absolute top-0 -right-1/4 w-full h-full bg-gradient-to-br from-cyan-500/20 via-blue-500/20 to-transparent blur-3xl animate-aurora-slow-3" />
          <div className="absolute bottom-0 -left-1/4 w-[150%] h-2/3 bg-gradient-to-t from-blue-600/20 via-transparent to-transparent blur-2xl animate-aurora-slow-4" />
          <div
            className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[120%] h-full blur-3xl animate-aurora-pulse"
            style={{ background: "radial-gradient(circle, rgba(34,211,238,0.1) 0%, transparent 70%)" }}
          />
        </div>

        {/* Subtle light streaks */}
        <div className="absolute inset-0 opacity-20">
          <div className="absolute top-0 left-[10%] w-px h-full bg-gradient-to-b from-transparent via-cyan-400/50 to-transparent animate-streak-1" />
          <div className="absolute top-0 left-[30%] w-px h-full bg-gradient-to-b from-transparent via-blue-400/50 to-transparent animate-streak-2" />
          <div className="absolute top-0 left-1/2 w-px h-full bg-gradient-to-b from-transparent via-cyan-400/50 to-transparent animate-streak-3" />
          <div className="absolute top-0 left-[70%] w-px h-full bg-gradient-to-b from-transparent via-blue-400/50 to-transparent animate-streak-1" />
          <div className="absolute top-0 left-[90%] w-px h-full bg-gradient-to-b from-transparent via-cyan-400/50 to-transparent animate-streak-2" />
        </div>

        {/* Floating particles */}
        <div className="absolute inset-0">
          <div className="absolute top-[10%] left-[5%] w-1.5 h-1.5 bg-white/60 rounded-full animate-particle-float-1" />
          <div className="absolute top-[25%] left-[12%] w-1 h-1 bg-cyan-400/50 rounded-full animate-particle-float-3" />
          <div className="absolute top-[45%] left-[8%] w-2 h-2 bg-white/40 rounded-full animate-particle-float-5" />
          <div className="absolute top-[15%] left-[25%] w-1 h-1 bg-white/50 rounded-full animate-particle-float-2" />
          <div className="absolute top-[35%] left-[30%] w-1.5 h-1.5 bg-cyan-400/60 rounded-full animate-particle-float-6" />
          <div className="absolute top-[20%] left-[45%] w-1.5 h-1.5 bg-white/60 rounded-full animate-particle-float-8" />
          <div className="absolute top-[60%] left-[48%] w-2 h-2 bg-cyan-300/60 rounded-full animate-particle-float-5" />
          <div className="absolute top-[30%] left-[70%] w-1.5 h-1.5 bg-white/70 rounded-full animate-particle-float-7" />
          <div className="absolute top-[50%] left-[68%] w-1 h-1 bg-cyan-400/60 rounded-full animate-particle-float-6" />
          <div className="absolute top-[18%] left-[85%] w-1.5 h-1.5 bg-white/50 rounded-full animate-particle-float-3" />
          <div className="absolute top-[58%] left-[88%] w-2 h-2 bg-cyan-400/60 rounded-full animate-particle-float-5" />
          <div className="absolute top-[78%] left-[92%] w-1 h-1 bg-white/60 rounded-full animate-particle-float-4" />
        </div>
      </div>

      {/* ── Sticky header ───────────────────────────────────────────────── */}
      <header className="sticky top-0 z-50 border-b border-white/10 bg-[hsl(220,48%,9%)]/80 backdrop-blur-xl">
        <div className="w-full px-6 py-3 flex items-center justify-between">
          <Link href="https://regioniq.io" className="flex items-center gap-2.5">
            <div className="relative h-9 w-9 flex-shrink-0">
              <Image
                src="/Frame 11.png"
                alt="RegionIQ"
                fill
                className="object-contain"
                priority
              />
            </div>
            <span className="text-lg font-bold text-white tracking-tight">RegionIQ</span>
          </Link>
        </div>
      </header>

      {/* ── Content ─────────────────────────────────────────────────────── */}
      <div className="relative z-10">
        <DataRoadmap />
      </div>
    </div>
  )
}
