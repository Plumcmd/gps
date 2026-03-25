import * as React from "react"
import { cva, type VariantProps } from "class-variance-authority"
import { Slot } from "radix-ui"
import { cn } from "@/lib/utils"

const buttonVariants = cva(
  "group/button inline-flex shrink-0 items-center justify-center rounded-xl border bg-clip-padding text-sm font-medium whitespace-nowrap transition-all duration-200 outline-none select-none active:scale-[0.97] disabled:pointer-events-none disabled:opacity-50 [&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg:not([class*='size-'])]:size-4",
  {
    variants: {
      variant: {
        default:
          "bg-green-700 text-white hover:bg-green-600 shadow-lg shadow-green-900/40 border-green-800/40 hover:shadow-green-800/40",

        outline:
          "border-zinc-700 text-zinc-200 bg-zinc-900/40 hover:bg-zinc-800/60 hover:text-white shadow-md shadow-black/20 backdrop-blur-md",

        secondary:
          "bg-zinc-800 text-zinc-200 hover:bg-zinc-700 border-zinc-700 shadow-md shadow-black/30",

        ghost:
          "text-zinc-300 hover:bg-zinc-800/60 hover:text-white transition-colors",

        destructive:
          "bg-red-900/40 text-red-300 border-red-800 hover:bg-red-800/60 hover:text-red-200 shadow-md shadow-red-900/40",

        link: "text-green-500 underline-offset-4 hover:underline",
      },

      size: {
        default: "h-10 px-4 rounded-xl gap-2",
        sm: "h-8 px-3 rounded-lg text-xs gap-1.5",
        lg: "h-12 px-5 rounded-xl text-base gap-2.5",
        icon: "size-10 rounded-xl",
      },
    },

    defaultVariants: {
      variant: "default",
      size: "default",
    },
  }
)

function Button({
  className,
  variant = "default",
  size = "default",
  asChild = false,
  ...props
}: React.ComponentProps<"button"> &
  VariantProps<typeof buttonVariants> & {
    asChild?: boolean
  }) {
  const Comp = asChild ? Slot.Root : "button"

  return (
    <Comp
      data-slot="button"
      data-variant={variant}
      data-size={size}
      className={cn(buttonVariants({ variant, size, className }))}
      {...props}
    />
  )
}

export { Button, buttonVariants }
