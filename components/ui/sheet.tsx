"use client"

import * as React from "react"
import { X } from "lucide-react"

import { cn } from "@/lib/utils"

const Sheet = ({ children }: React.PropsWithChildren) => <div>{children}</div>
const SheetTrigger = React.forwardRef<HTMLButtonElement, React.ButtonHTMLAttributes<HTMLButtonElement>>(
  ({ className, ...props }, ref) => <button ref={ref} className={cn(className)} {...props} />
)
SheetTrigger.displayName = "SheetTrigger"

const SheetClose = React.forwardRef<HTMLButtonElement, React.ButtonHTMLAttributes<HTMLButtonElement>>(
  ({ className, ...props }, ref) => <button ref={ref} className={cn(className)} {...props} />
)
SheetClose.displayName = "SheetClose"

const SheetPortal = ({ children }: React.PropsWithChildren) => <>{children}</>

const SheetOverlay = React.forwardRef<HTMLDivElement, React.HTMLAttributes<HTMLDivElement>>(({ className, ...props }, ref) => (
  <div ref={ref} className={cn("fixed inset-0 z-50 bg-black/80", className)} {...props} />
))
SheetOverlay.displayName = "SheetOverlay"

interface SheetContentProps extends React.HTMLAttributes<HTMLDivElement> {
  side?: "top" | "bottom" | "left" | "right"
}

const sideClasses: Record<NonNullable<SheetContentProps["side"]>, string> = {
  top: "inset-x-0 top-0 border-b",
  bottom: "inset-x-0 bottom-0 border-t",
  left: "inset-y-0 left-0 h-full w-3/4 border-r sm:max-w-sm",
  right: "inset-y-0 right-0 h-full w-3/4 border-l sm:max-w-sm",
}

const SheetContent = React.forwardRef<HTMLDivElement, SheetContentProps>(
  ({ side = "right", className, children, ...props }, ref) => (
    <SheetPortal>
      <SheetOverlay />
      <div ref={ref} className={cn("fixed z-50 gap-4 bg-background p-6 shadow-lg", sideClasses[side], className)} {...props}>
        <button className="absolute right-4 top-4 rounded-sm opacity-70 transition-opacity hover:opacity-100">
          <X className="h-4 w-4" />
          <span className="sr-only">Close</span>
        </button>
        {children}
      </div>
    </SheetPortal>
  )
)
SheetContent.displayName = "SheetContent"

const SheetHeader = ({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) => (
  <div className={cn("flex flex-col space-y-2 text-center sm:text-left", className)} {...props} />
)
SheetHeader.displayName = "SheetHeader"

const SheetFooter = ({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) => (
  <div className={cn("flex flex-col-reverse sm:flex-row sm:justify-end sm:space-x-2", className)} {...props} />
)
SheetFooter.displayName = "SheetFooter"

const SheetTitle = React.forwardRef<HTMLHeadingElement, React.HTMLAttributes<HTMLHeadingElement>>(
  ({ className, ...props }, ref) => <h2 ref={ref} className={cn("text-lg font-semibold text-foreground", className)} {...props} />
)
SheetTitle.displayName = "SheetTitle"

const SheetDescription = React.forwardRef<HTMLParagraphElement, React.HTMLAttributes<HTMLParagraphElement>>(
  ({ className, ...props }, ref) => <p ref={ref} className={cn("text-sm text-muted-foreground", className)} {...props} />
)
SheetDescription.displayName = "SheetDescription"

export {
  Sheet,
  SheetPortal,
  SheetOverlay,
  SheetTrigger,
  SheetClose,
  SheetContent,
  SheetHeader,
  SheetFooter,
  SheetTitle,
  SheetDescription,
}
