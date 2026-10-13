"use client"

import * as React from "react"
import { ChevronLeft, ChevronRight } from "lucide-react"
import { DayPicker } from "react-day-picker"

import { cn } from "@/lib/utils"
import { buttonVariants } from "@/components/ui/button"

export type CalendarProps = React.ComponentProps<typeof DayPicker>

function Calendar({
  className,
  classNames,
  showOutsideDays = true,
  ...props
}: CalendarProps) {
  return (
    <DayPicker
      showOutsideDays={showOutsideDays}
      className={cn("w-full p-3", className)}
      classNames={{
        months: "flex w-full",
        month: "w-full space-y-4",
        month_caption: "relative flex h-9 items-center justify-center",
        caption_label: "text-sm font-semibold capitalize",
        nav: "absolute inset-x-0 top-0 flex items-center justify-between",
        button_previous: cn(
          buttonVariants({ variant: "outline" }),
          "h-8 w-8 bg-transparent p-0 opacity-70 hover:opacity-100"
        ),
        button_next: cn(
          buttonVariants({ variant: "outline" }),
          "h-8 w-8 bg-transparent p-0 opacity-70 hover:opacity-100"
        ),
        month_grid: "w-full border-collapse",
        weekdays: "grid grid-cols-7",
        weekday: "py-2 text-center text-xs font-semibold text-muted-foreground",
        weeks: "grid gap-y-1",
        week: "grid grid-cols-7",
        day: "relative aspect-square min-w-0 p-0 text-center",
        day_button: cn(
          buttonVariants({ variant: "ghost" }),
          "h-full w-full rounded-lg p-0 font-normal aria-selected:opacity-100"
        ),
        selected: "[&>button]:bg-[#f36f3d] [&>button]:text-white [&>button]:hover:bg-[#e65e2b]",
        today: "[&>button]:border [&>button]:border-[#a4b342] [&>button]:font-bold",
        outside: "text-muted-foreground opacity-40",
        disabled: "text-muted-foreground opacity-40",
        range_middle: "[&>button]:rounded-none [&>button]:bg-orange-50 [&>button]:text-foreground",
        hidden: "invisible",
        ...classNames,
      }}
      components={{
        Chevron: ({ ...props }) => {
          if (props.orientation === 'left') return <ChevronLeft className="h-4 w-4" />
          return <ChevronRight className="h-4 w-4" />
        }
      }}
      {...props}
    />
  )
}
Calendar.displayName = "Calendar"

export { Calendar }
