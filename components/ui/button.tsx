import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";

const buttonVariants = cva(
    "inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-lg text-sm font-semibold transition-all duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-purple-500 focus-visible:ring-offset-2 focus-visible:ring-offset-black disabled:pointer-events-none disabled:opacity-50 [&_svg]:pointer-events-none [&_svg]:size-4 [&_svg]:shrink-0",
    {
        variants: {
            variant: {
                default:
                    "bg-gradient-to-r from-purple-600 to-pink-600 text-white shadow-lg shadow-purple-900/30 hover:shadow-purple-500/40 hover:from-purple-500 hover:to-pink-500 hover:scale-[1.02] active:scale-[0.98]",
                secondary:
                    "bg-gray-800/80 text-white border border-gray-700 hover:bg-gray-700/80 hover:border-gray-600 backdrop-blur-sm",
                outline:
                    "border border-purple-500/50 text-purple-400 bg-purple-900/10 hover:bg-purple-900/30 hover:border-purple-400 hover:text-purple-300 backdrop-blur-sm",
                ghost:
                    "text-gray-400 hover:text-white hover:bg-gray-800/50",
                link:
                    "text-purple-400 underline-offset-4 hover:underline hover:text-purple-300",
                cyber:
                    "relative bg-black text-cyan-400 border border-cyan-500/50 hover:border-cyan-400 hover:text-cyan-300 hover:shadow-lg hover:shadow-cyan-500/20 before:absolute before:inset-0 before:bg-cyan-500/5 before:rounded-lg overflow-hidden group",
                destructive:
                    "bg-red-900/80 text-red-100 border border-red-700 hover:bg-red-800/80 hover:border-red-600",
            },
            size: {
                default: "h-11 px-6 py-2",
                sm: "h-9 px-4 text-xs",
                lg: "h-12 px-8 text-base",
                xl: "h-14 px-10 text-lg",
                icon: "h-10 w-10",
            },
        },
        defaultVariants: {
            variant: "default",
            size: "default",
        },
    }
);

export interface ButtonProps
    extends React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {
    asChild?: boolean;
}

const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
    ({ className, variant, size, ...props }, ref) => {
        return (
            <button
                className={cn(buttonVariants({ variant, size, className }))}
                ref={ref}
                {...props}
            />
        );
    }
);
Button.displayName = "Button";

export { Button, buttonVariants };
