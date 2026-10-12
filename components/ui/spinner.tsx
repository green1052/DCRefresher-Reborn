import { cn } from "cn"
import { Loader2Icon } from "lucide-react"

function Spinner({ className, ...props }: React.ComponentProps<"svg">) {
  return (
    <Loader2Icon data-slot="spinner" role="status" aria-label="불러오는 중" className={cn("size-4 animate-spin", className)} {...props} />
  )
}

export { Spinner }
