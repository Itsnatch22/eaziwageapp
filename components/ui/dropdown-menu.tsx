"use client"

import * as React from "react"

import { cn } from "@/lib/utils"

const DropdownMenu = ({ children }: React.PropsWithChildren) => <div>{children}</div>
const DropdownMenuTrigger = React.forwardRef<HTMLButtonElement, React.ButtonHTMLAttributes<HTMLButtonElement>>(
  ({ className, ...props }, ref) => <button ref={ref} className={cn(className)} {...props} />
)
DropdownMenuTrigger.displayName = "DropdownMenuTrigger"

const DropdownMenuGroup = ({ children }: React.PropsWithChildren) => <div>{children}</div>
const DropdownMenuPortal = ({ children }: React.PropsWithChildren) => <>{children}</>
const DropdownMenuSub = ({ children }: React.PropsWithChildren) => <div>{children}</div>
const DropdownMenuRadioGroup = ({ children }: React.PropsWithChildren) => <div>{children}</div>

const DropdownMenuSubTrigger = React.forwardRef<HTMLButtonElement, React.ButtonHTMLAttributes<HTMLButtonElement> & { inset?: boolean }>(
  ({ className, inset, ...props }, ref) => (
    <button ref={ref} className={cn("flex items-center px-2 py-1.5 text-sm", inset && "pl-8", className)} {...props} />
  )
)
DropdownMenuSubTrigger.displayName = "DropdownMenuSubTrigger"

const DropdownMenuSubContent = React.forwardRef<HTMLDivElement, React.HTMLAttributes<HTMLDivElement>>(
  ({ className, ...props }, ref) => <div ref={ref} className={cn("min-w-[8rem] rounded-md border p-1", className)} {...props} />
)
DropdownMenuSubContent.displayName = "DropdownMenuSubContent"

const DropdownMenuContent = React.forwardRef<HTMLDivElement, React.HTMLAttributes<HTMLDivElement> & { sideOffset?: number }>(
  ({ className, ...props }, ref) => <div ref={ref} className={cn("min-w-[8rem] rounded-md border p-1", className)} {...props} />
)
DropdownMenuContent.displayName = "DropdownMenuContent"

const DropdownMenuItem = React.forwardRef<HTMLButtonElement, React.ButtonHTMLAttributes<HTMLButtonElement> & { inset?: boolean }>(
  ({ className, inset, ...props }, ref) => (
    <button ref={ref} className={cn("flex w-full items-center rounded-sm px-2 py-1.5 text-sm", inset && "pl-8", className)} {...props} />
  )
)
DropdownMenuItem.displayName = "DropdownMenuItem"

const DropdownMenuCheckboxItem = React.forwardRef<HTMLInputElement, React.InputHTMLAttributes<HTMLInputElement>>(
  ({ className, ...props }, ref) => <input ref={ref} type="checkbox" className={cn(className)} {...props} />
)
DropdownMenuCheckboxItem.displayName = "DropdownMenuCheckboxItem"

const DropdownMenuRadioItem = React.forwardRef<HTMLInputElement, React.InputHTMLAttributes<HTMLInputElement>>(
  ({ className, ...props }, ref) => <input ref={ref} type="radio" className={cn(className)} {...props} />
)
DropdownMenuRadioItem.displayName = "DropdownMenuRadioItem"

const DropdownMenuLabel = React.forwardRef<HTMLDivElement, React.HTMLAttributes<HTMLDivElement> & { inset?: boolean }>(
  ({ className, inset, ...props }, ref) => <div ref={ref} className={cn("px-2 py-1.5 text-sm font-semibold", inset && "pl-8", className)} {...props} />
)
DropdownMenuLabel.displayName = "DropdownMenuLabel"

const DropdownMenuSeparator = React.forwardRef<HTMLDivElement, React.HTMLAttributes<HTMLDivElement>>(
  ({ className, ...props }, ref) => <div ref={ref} className={cn("my-1 h-px bg-muted", className)} {...props} />
)
DropdownMenuSeparator.displayName = "DropdownMenuSeparator"

const DropdownMenuShortcut = ({ className, ...props }: React.HTMLAttributes<HTMLSpanElement>) => {
  return <span className={cn("ml-auto text-xs tracking-widest opacity-60", className)} {...props} />
}
DropdownMenuShortcut.displayName = "DropdownMenuShortcut"

export {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuCheckboxItem,
  DropdownMenuRadioItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuShortcut,
  DropdownMenuGroup,
  DropdownMenuPortal,
  DropdownMenuSub,
  DropdownMenuSubContent,
  DropdownMenuSubTrigger,
  DropdownMenuRadioGroup,
}
