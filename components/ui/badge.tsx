import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";

const badgeVariants = cva(
    "inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-semibold transition-all duration-200",
    {
        variants: {
            variant: {
                default:
                    "bg-gray-800 text-gray-300 border border-gray-700",
                success:
                    "bg-green-900/30 text-green-400 border border-green-500/50 shadow-sm shadow-green-500/10",
                warning:
                    "bg-yellow-900/30 text-yellow-400 border border-yellow-500/50 shadow-sm shadow-yellow-500/10",
                error:
                    "bg-red-900/30 text-red-400 border border-red-500/50 shadow-sm shadow-red-500/10",
                purple:
                    "bg-purple-900/30 text-purple-300 border border-purple-500/50 shadow-sm shadow-purple-500/10",
                cyan:
                    "bg-cyan-900/30 text-cyan-400 border border-cyan-500/50 shadow-sm shadow-cyan-500/10",
                outline:
                    "bg-transparent text-gray-400 border border-gray-600 hover:border-gray-500",
                glow:
                    "bg-purple-900/30 text-purple-300 border border-purple-500/50 shadow-lg shadow-purple-500/20 animate-pulse",
            },
        },
        defaultVariants: {
            variant: "default",
        },
    }
);

export interface BadgeProps
    extends React.HTMLAttributes<HTMLDivElement>,
    VariantProps<typeof badgeVariants> {
    pulse?: boolean;
}

function Badge({ className, variant, pulse, ...props }: BadgeProps) {
    return (
        <div
            className={cn(
                badgeVariants({ variant }),
                pulse && "animate-pulse",
                className
            )}
            {...props}
        />
    );
}

export { Badge, badgeVariants };
