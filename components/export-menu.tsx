"use client"

import { useState } from "react"
import { Download, FileText, Share2, Check, ImageDown, FileSpreadsheet } from "lucide-react"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { Button } from "@/components/ui/button"
import { useToast } from "@/hooks/use-toast"
import { exportCSV, shareURL as shareURLImpl } from "@/lib/export"

interface ExportMenuProps {
  data?: any[]
  filename?: string
  disabled?: boolean
  /** Optional: export a PNG of the current visual (caller owns capture + download). */
  onExportPng?: () => void | Promise<void>
  /** Optional: export an Excel file (caller owns workbook build + download). */
  onExportXlsx?: () => void | Promise<void>
}

export function ExportMenu({
  data = [],
  filename = "regioniq-export",
  disabled = false,
  onExportPng,
  onExportXlsx,
}: ExportMenuProps) {
  const { toast } = useToast()
  const [copied, setCopied] = useState(false)

  const handleExportCsv = () => {
    try {
      if (!data || data.length === 0) {
        toast({
          title: "No data to export",
          description: "There's no data available to export.",
          variant: "destructive",
        })
        return
      }
      exportCSV(data, filename)

      toast({
        title: "Export successful",
        description: `${filename}.csv has been downloaded.`,
      })
    } catch (error) {
      toast({
        title: "Export failed",
        description: "There was an error exporting your data.",
        variant: "destructive",
      })
    }
  }

  const exportPDF = () => {
    toast({
      title: "PDF Export",
      description: "PDF export feature is coming soon.",
    })
  }

  const handleShareUrl = async () => {
    try {
      await shareURLImpl()
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)

      toast({
        title: "Link copied",
        description: "Dashboard link has been copied to clipboard.",
      })
    } catch (error) {
      toast({
        title: "Copy failed",
        description: "Unable to copy link to clipboard.",
        variant: "destructive",
      })
    }
  }

  const handleExportPng = async () => {
    if (!onExportPng) return
    try {
      await onExportPng()
      toast({ title: "Export started", description: "Downloading PNG…" })
    } catch (error) {
      toast({ title: "PNG export failed", description: "Unable to export PNG.", variant: "destructive" })
    }
  }

  const handleExportXlsx = async () => {
    if (!onExportXlsx) return
    try {
      await onExportXlsx()
      toast({ title: "Export started", description: "Downloading Excel…" })
    } catch (error) {
      toast({ title: "Excel export failed", description: "Unable to export Excel.", variant: "destructive" })
    }
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          variant="outline"
          size="sm"
          disabled={disabled}
          className="cursor-pointer bg-transparent border-0 shadow-none h-auto px-1 py-0.5 text-sm font-medium hover:bg-transparent"
          data-riq-hide-on-export="true"
        >
          <Download className="h-4 w-4 mr-1" />
          Export
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-48">
        {onExportPng && (
          <DropdownMenuItem onClick={handleExportPng} className="cursor-pointer">
            <ImageDown className="h-4 w-4 mr-2" />
            Export PNG
          </DropdownMenuItem>
        )}
        {onExportXlsx && (
          <DropdownMenuItem onClick={handleExportXlsx} className="cursor-pointer">
            <FileSpreadsheet className="h-4 w-4 mr-2" />
            Export Excel
          </DropdownMenuItem>
        )}
        {data?.length > 0 && (
          <DropdownMenuItem onClick={handleExportCsv} className="cursor-pointer">
          <FileText className="h-4 w-4 mr-2" />
            Export CSV
        </DropdownMenuItem>
        )}
        <DropdownMenuItem onClick={exportPDF} disabled className="cursor-pointer opacity-50">
          <FileText className="h-4 w-4 mr-2" />
          Export as PDF
          <span className="ml-auto text-xs text-muted-foreground">Soon</span>
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuItem onClick={handleShareUrl} className="cursor-pointer">
          {copied ? <Check className="h-4 w-4 mr-2 text-green-500" /> : <Share2 className="h-4 w-4 mr-2" />}
          {copied ? "Copied!" : "Copy share link"}
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
