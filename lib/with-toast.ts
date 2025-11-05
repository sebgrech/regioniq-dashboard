import { toast } from "@/hooks/use-toast"

interface ToastMessages {
  loading?: string
  success?: string
  error?: string
}

export async function withToast<T>(promise: Promise<T>, messages: ToastMessages = {}): Promise<T> {
  const { loading = "Loading...", success = "Success", error = "Something went wrong" } = messages

  // Show loading toast
  const toastId = toast({
    title: loading,
    description: "Please wait...",
  })

  try {
    const result = await promise

    // Update to success toast
    toast({
      title: success,
      description: "Operation completed successfully",
    })

    return result
  } catch (err) {
    // Update to error toast
    const errorMessage = err instanceof Error ? err.message : error
    toast({
      title: "Error",
      description: errorMessage,
      variant: "destructive",
    })

    throw err
  }
}

// Convenience wrapper for data fetching
export async function withDataToast<T>(promise: Promise<T>, operation = "fetch data"): Promise<T> {
  return withToast(promise, {
    loading: `Loading ${operation}...`,
    success: `${operation.charAt(0).toUpperCase() + operation.slice(1)} loaded`,
    error: `Failed to ${operation}`,
  })
}

// Convenience wrapper for save operations
export async function withSaveToast<T>(promise: Promise<T>, operation = "save"): Promise<T> {
  return withToast(promise, {
    loading: `Saving ${operation}...`,
    success: `${operation.charAt(0).toUpperCase() + operation.slice(1)} saved`,
    error: `Failed to ${operation}`,
  })
}
