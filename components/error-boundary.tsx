"use client"

import React from "react"
import { AlertCircle, RefreshCw } from "lucide-react"
import { Card, CardContent } from "@/components/ui/card"
import { Button } from "@/components/ui/button"

interface ErrorBoundaryState {
  hasError: boolean
  error?: Error
}

interface ErrorBoundaryProps {
  children: React.ReactNode
  fallback?: React.ComponentType<{ error?: Error; resetErrorBoundary: () => void }>
}

export class ErrorBoundary extends React.Component<ErrorBoundaryProps, ErrorBoundaryState> {
  constructor(props: ErrorBoundaryProps) {
    super(props)
    this.state = { hasError: false }
  }

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return { hasError: true, error }
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    console.error("Error caught by boundary:", error, errorInfo)
  }

  resetErrorBoundary = () => {
    this.setState({ hasError: false, error: undefined })
  }

  render() {
    if (this.state.hasError) {
      const FallbackComponent = this.props.fallback || DefaultErrorFallback
      return <FallbackComponent error={this.state.error} resetErrorBoundary={this.resetErrorBoundary} />
    }

    return this.props.children
  }
}

function DefaultErrorFallback({ error, resetErrorBoundary }: { error?: Error; resetErrorBoundary: () => void }) {
  return (
    <Card className="p-8 text-center border-destructive/20">
      <CardContent className="space-y-4">
        <div className="flex justify-center">
          <div className="w-12 h-12 rounded-full bg-destructive/10 flex items-center justify-center">
            <AlertCircle className="h-6 w-6 text-destructive" />
          </div>
        </div>
        <div className="space-y-2">
          <h3 className="text-lg font-semibold">Something went wrong</h3>
          <p className="text-muted-foreground">
            {error?.message || "An unexpected error occurred while loading this component."}
          </p>
        </div>
        <Button onClick={resetErrorBoundary} variant="outline" className="gap-2 bg-transparent">
          <RefreshCw className="h-4 w-4" />
          Try again
        </Button>
      </CardContent>
    </Card>
  )
}

// Convenience wrapper for sections
export function ErrorBoundaryWrapper({
  children,
  name = "component",
}: {
  children: React.ReactNode
  name?: string
}) {
  return (
    <ErrorBoundary
      fallback={({ error, resetErrorBoundary }) => (
        <Card className="p-8 text-center border-destructive/20">
          <CardContent className="space-y-4">
            <div className="flex justify-center">
              <div className="w-12 h-12 rounded-full bg-destructive/10 flex items-center justify-center">
                <AlertCircle className="h-6 w-6 text-destructive" />
              </div>
            </div>
            <div className="space-y-2">
              <h3 className="text-lg font-semibold">Error loading {name}</h3>
              <p className="text-muted-foreground text-sm">
                {error?.message || `The ${name} component encountered an error and couldn't load properly.`}
              </p>
            </div>
            <Button onClick={resetErrorBoundary} variant="outline" size="sm" className="gap-2 bg-transparent">
              <RefreshCw className="h-4 w-4" />
              Retry
            </Button>
          </CardContent>
        </Card>
      )}
    >
      {children}
    </ErrorBoundary>
  )
}
