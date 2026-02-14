"use client"

import * as React from "react"

import { cn } from "@/lib/utils"

interface SwitchProps extends Omit<React.ButtonHTMLAttributes<HTMLButtonElement>, "onChange"> {
  checked?: boolean
  defaultChecked?: boolean
  onCheckedChange?: (checked: boolean) => void
}

const Switch = React.forwardRef<HTMLButtonElement, SwitchProps>(
  ({ className, checked, defaultChecked = false, onCheckedChange, onClick, ...props }, ref) => {
    const [internalChecked, setInternalChecked] = React.useState(defaultChecked)
    const isChecked = checked ?? internalChecked

    return (
      <button
        type="button"
        role="switch"
        aria-checked={isChecked}
        className={cn(
          "peer inline-flex h-6 w-11 shrink-0 cursor-pointer items-center rounded-full border-2 border-transparent transition-colors disabled:cursor-not-allowed disabled:opacity-50",
          isChecked ? "bg-primary" : "bg-input",
          className
        )}
        onClick={(event) => {
          const next = !isChecked
          if (checked === undefined) {
            setInternalChecked(next)
          }
          onCheckedChange?.(next)
          onClick?.(event)
        }}
        ref={ref}
        {...props}
      >
        <span
          className={cn(
            "pointer-events-none block h-5 w-5 rounded-full bg-background shadow-lg ring-0 transition-transform",
            isChecked ? "translate-x-5" : "translate-x-0"
          )}
        />
      </button>
    )
  }
)
Switch.displayName = "Switch"

export { Switch }
