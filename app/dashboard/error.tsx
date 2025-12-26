"use client"

import { useEffect } from "react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { AlertTriangle, RefreshCw, Home } from "lucide-react"

export default function DashboardError({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  useEffect(() => {
    // Log error for debugging
    console.error("Dashboard error:", error)
  }, [error])

  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-4">
      <Card className="w-full max-w-md">
        <CardHeader className="text-center">
          <div className="mx-auto mb-4 h-12 w-12 rounded-full bg-destructive/10 flex items-center justify-center">
            <AlertTriangle className="h-6 w-6 text-destructive" />
          </div>
          <CardTitle className="text-2xl">Dashboard Error</CardTitle>
          <CardDescription>
            Something went wrong while loading the dashboard. This is usually temporary.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Button onClick={reset} className="w-full">
              <RefreshCw className="h-4 w-4 mr-2" />
              Try Again
            </Button>
            <Button variant="outline" asChild className="w-full bg-transparent">
              <a href="/">
                <Home className="h-4 w-4 mr-2" />
                Return Home
              </a>
            </Button>
          </div>

          {process.env.NODE_ENV === "development" && error.message && (
            <div className="pt-4 border-t">
              <p className="text-xs text-muted-foreground font-mono break-all">
                {error.message}
              </p>
            </div>
          )}

          {error.digest && (
            <div className="pt-2">
              <p className="text-xs text-muted-foreground text-center">
                Error ID: {error.digest}
              </p>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}

