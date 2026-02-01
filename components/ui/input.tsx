import * as React from "react";
import { cn } from "@/lib/utils";

export interface InputProps
    extends React.InputHTMLAttributes<HTMLInputElement> {
    variant?: "default" | "terminal";
}

const Input = React.forwardRef<HTMLInputElement, InputProps>(
    ({ className, type, variant = "default", ...props }, ref) => {
        const variants = {
            default:
                "bg-gray-900/80 border-gray-700 focus:border-purple-500 focus:ring-purple-500/20",
            terminal:
                "bg-black border-gray-800 font-mono focus:border-cyan-500 focus:ring-cyan-500/20 text-cyan-400 placeholder:text-gray-600",
        };

        return (
            <input
                type={type}
                className={cn(
                    "flex h-11 w-full rounded-lg border px-4 py-2 text-sm text-white placeholder:text-gray-500 transition-all duration-200",
                    "focus:outline-none focus:ring-2",
                    "disabled:cursor-not-allowed disabled:opacity-50",
                    "file:border-0 file:bg-transparent file:text-sm file:font-medium",
                    variants[variant],
                    className
                )}
                ref={ref}
                {...props}
            />
        );
    }
);
Input.displayName = "Input";

export { Input };
