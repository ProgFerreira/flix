import type { ReactNode } from "react"

export function CourseFallback({ message, action }: { message: string; action?: ReactNode }) {
  return (
    <div className="classroom">
      <div className="empty">
        <p>{message}</p>
        {action}
      </div>
    </div>
  )
}
