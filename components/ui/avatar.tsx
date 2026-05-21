import * as React from "react"
import Image from "next/image"

import { cn } from "@/lib/utils"

const Avatar = React.forwardRef<HTMLDivElement, React.HTMLAttributes<HTMLDivElement>>(
  ({ className, ...props }, ref) => (
    <div
      ref={ref}
      className={cn("relative flex h-10 w-10 shrink-0 overflow-hidden rounded-full", className)}
      {...props}
    />
  )
)
Avatar.displayName = "Avatar"

type AvatarImageProps = Omit<React.ComponentProps<typeof Image>, "alt" | "src"> & {
  alt: string
  src?: string
}

const AvatarImage = React.forwardRef<HTMLImageElement, AvatarImageProps>(
  ({ className, src, alt, sizes = "40px", ...props }, ref) => {
    if (!src) return null

    return (
      <Image
        ref={ref}
        src={src}
        alt={alt}
        fill
        sizes={sizes}
        className={cn("aspect-square h-full w-full object-cover", className)}
        {...props}
      />
    )
  }
)
AvatarImage.displayName = "AvatarImage"

const AvatarFallback = React.forwardRef<HTMLDivElement, React.HTMLAttributes<HTMLDivElement>>(
  ({ className, ...props }, ref) => (
    <div
      ref={ref}
      suppressHydrationWarning
      className={cn("flex h-full w-full items-center justify-center rounded-full bg-muted", className)}
      {...props}
    />
  )
)
AvatarFallback.displayName = "AvatarFallback"

export { Avatar, AvatarImage, AvatarFallback }
