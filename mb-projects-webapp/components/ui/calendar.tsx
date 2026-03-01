"use client"

import * as React from "react"
import { ChevronLeft, ChevronRight } from "lucide-react"
import { DayPicker } from "react-day-picker"

import { cn } from "@/lib/utils"
import { buttonVariants } from "@/components/ui/button"

function Calendar({
    className,
    classNames,
    showOutsideDays = true,
    ...props
}: React.ComponentProps<typeof DayPicker>) {
    return (
        <DayPicker
            showOutsideDays={showOutsideDays}
            className={cn("p-3", className)}
            classNames={{
                months: "flex flex-col sm:flex-row gap-4",
                month: "space-y-4",
                month_caption: "flex justify-center relative items-center h-9 px-10 mb-2",
                caption_label: cn("text-sm font-medium", props.captionLayout === "dropdown" && "hidden"),
                nav: "flex items-center justify-between absolute inset-x-0 h-9 px-2 pointer-events-none z-10",
                button_previous: cn(
                    buttonVariants({ variant: "outline" }),
                    "h-7 w-7 bg-transparent p-0 opacity-50 hover:opacity-100 relative pointer-events-auto z-20"
                ),
                button_next: cn(
                    buttonVariants({ variant: "outline" }),
                    "h-7 w-7 bg-transparent p-0 opacity-50 hover:opacity-100 relative pointer-events-auto z-20"
                ),
                month_grid: "w-full border-collapse space-y-1",
                weekdays: "grid grid-cols-7",
                weekday: "text-slate-500 rounded-md w-9 font-normal text-[0.8rem] dark:text-slate-400 flex items-center justify-center",
                week: "grid grid-cols-7 w-full mt-2",
                day: "h-9 w-9 text-center text-sm p-0 relative flex items-center justify-center",
                day_button: cn(
                    buttonVariants({ variant: "ghost" }),
                    "h-9 w-9 p-0 font-normal aria-selected:opacity-100"
                ),
                selected: "bg-slate-900 text-slate-50 hover:bg-slate-900 hover:text-slate-50 focus:bg-slate-900 focus:text-slate-50 dark:bg-slate-50 dark:text-slate-900 rounded-md",
                today: "bg-slate-100 text-slate-900 dark:bg-slate-800 dark:text-slate-50",
                outside: "day-outside text-slate-500 opacity-50 dark:text-slate-400 font-light",
                disabled: "text-slate-500 opacity-50 dark:text-slate-400",
                hidden: "invisible",
                dropdown: "flex items-center gap-1 cursor-pointer bg-transparent border-none p-0 font-medium text-sm focus:ring-0",
                dropdowns: "flex justify-center items-center gap-2",
                caption_dropdowns: "flex items-center justify-center gap-1",
                ...classNames,
            }}
            components={{
                Chevron: (props) => {
                    const Icon = props.orientation === "left" ? ChevronLeft : ChevronRight;
                    return <Icon className="h-4 w-4" />
                }
            }}
            {...props}
        />
    )
}
Calendar.displayName = "Calendar"

export { Calendar }
