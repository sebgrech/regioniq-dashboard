import { Suspense } from "react"
import { Loader2 } from "lucide-react"
import { DtreEconomicProfileShell } from "@/components/dtre/DtreEconomicProfileShell"

interface EconomicProfilePageProps {
  params: Promise<{
    slug: string
  }>
}

async function EconomicProfilePageContent({ params }: EconomicProfilePageProps) {
  const { slug } = await params
  return <DtreEconomicProfileShell slug={slug} />
}

export default function EconomicProfilePage(props: EconomicProfilePageProps) {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen bg-background flex items-center justify-center">
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <Loader2 className="h-4 w-4 animate-spin" />
            Loading Economic Profile...
          </div>
        </div>
      }
    >
      <EconomicProfilePageContent {...props} />
    </Suspense>
  )
}

