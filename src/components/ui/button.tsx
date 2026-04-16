/* eslint-disable react-refresh/only-export-components -- shadcn UI modules intentionally export helpers with components */
import * as React from "react";
import { Slot } from "@radix-ui/react-slot";
import { cva, type VariantProps } from "class-variance-authority";

import { cn } from "@/lib/utils";

const buttonVariants = cva(
  "inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-md text-sm font-medium ring-offset-background transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 [&_svg]:pointer-events-none [&_svg]:size-4 [&_svg]:shrink-0",
  {
    variants: {
      variant: {
        default: "bg-primary text-primary-foreground hover:bg-primary/90",
        destructive: "bg-destructive text-destructive-foreground hover:bg-destructive/90",
        outline: "border border-input bg-background hover:bg-accent hover:text-accent-foreground",
        secondary: "bg-secondary text-secondary-foreground hover:bg-secondary/80",
        ghost: "hover:bg-accent hover:text-accent-foreground",
        link: "text-primary underline-offset-4 hover:underline",
      },
      size: {
        default: "h-10 px-4 py-2",
        sm: "h-9 rounded-md px-3",
        lg: "h-11 rounded-md px-8",
        icon: "h-10 w-10 min-h-[44px] min-w-[44px] md:min-h-0 md:min-w-0",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "default",
    },
  },
);

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {
  asChild?: boolean;
}

const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant, size, asChild = false, ...props }, ref) => {
    const Comp = asChild ? Slot : "button";

    // Dev-only a11y warning: icon-sized buttons are almost always icon-only
    // (a single lucide icon as child). Without aria-label / aria-labelledby /
    // a visible text child a screen reader has nothing to announce. We log
    // once per render in development so the team can systematically fix
    // these as they're touched, without blocking production.
    if (
      import.meta.env.DEV &&
      size === "icon" &&
      !props["aria-label"] &&
      !props["aria-labelledby"] &&
      !(props as { title?: string }).title
    ) {
      const hasTextChild = React.Children.toArray(props.children).some(
        (c) => typeof c === "string" && c.trim().length > 0,
      );
      if (!hasTextChild) {
        // eslint-disable-next-line no-console
        console.warn(
          "[a11y] Icon-only <Button size=\"icon\"> is missing an accessible name. Add aria-label, aria-labelledby, or a title prop.",
        );
      }
    }

    return <Comp className={cn(buttonVariants({ variant, size, className }))} ref={ref} {...props} />;
  },
);
Button.displayName = "Button";

export { Button, buttonVariants };
