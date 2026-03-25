import { cn } from "@/lib/utils"

const sizeClasses = {
  sm: "size-4",
  md: "size-6",
  lg: "size-10",
} as const

interface LoadingSpinnerProps {
  size?: keyof typeof sizeClasses
  className?: string
}

export function LoadingSpinner({ size = "md", className }: LoadingSpinnerProps) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={cn(
        "animate-spin text-primary",
        sizeClasses[size],
        className
      )}
    >
      <circle
        cx="12"
        cy="12"
        r="10"
        className="opacity-20"
        strokeWidth="3"
      />
      <path
        d="M12 2a10 10 0 0 1 10 10"
        className="opacity-80"
        strokeWidth="3"
      />
    </svg>
  )
}

interface FullPageLoaderProps {
  size?: keyof typeof sizeClasses
}

export function FullPageLoader({ size = "lg" }: FullPageLoaderProps) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-background/80 backdrop-blur-sm">
      <LoadingSpinner size={size} />
    </div>
  )
}
