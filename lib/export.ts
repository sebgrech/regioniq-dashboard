export function exportCSV(data: any[], filename: string) {
  if (!data || data.length === 0) {
    throw new Error("No data to export")
  }

  const headers = Object.keys(data[0])
  const csvContent = [
    headers.join(","),
    ...data.map((row) =>
      headers
        .map((header) => {
          const value = row[header]
          // Escape commas and quotes in CSV
          if (typeof value === "string" && (value.includes(",") || value.includes('"'))) {
            return `"${value.replace(/"/g, '""')}"`
          }
          return value
        })
        .join(","),
    ),
  ].join("\n")

  // Create and download file
  const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" })
  const link = document.createElement("a")
  const url = URL.createObjectURL(blob)
  link.setAttribute("href", url)
  link.setAttribute("download", `${filename}.csv`)
  link.style.visibility = "hidden"
  document.body.appendChild(link)
  link.click()
  document.body.removeChild(link)
}

export async function shareURL() {
  const url = window.location.href
  await navigator.clipboard.writeText(url)
  return url
}

export function exportPDF(data: any[], filename: string) {
  // Placeholder for future PDF export functionality
  throw new Error("PDF export not yet implemented")
}
