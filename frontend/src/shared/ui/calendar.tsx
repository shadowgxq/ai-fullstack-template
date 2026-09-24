import * as React from "react"
import {
  DayPicker,
  getDefaultClassNames,
  type DayButton,
  type Locale,
} from "react-day-picker"

import { cn } from "@/shared/utils/cn"
import { Button, buttonVariants } from "@/shared/ui/button"
import { ChevronLeftIcon, ChevronRightIcon, ChevronDownIcon } from "lucide-react"

function Calendar({
  className,
  classNames,
  showOutsideDays = true,
  captionLayout = "label",
  buttonVariant = "ghost",
  locale,
  formatters,
  components,
  ...props
}: React.ComponentProps<typeof DayPicker> & {
  buttonVariant?: React.ComponentProps<typeof Button>["variant"]
}) {
  const defaultClassNames = getDefaultClassNames()

  return (
    <DayPicker
      showOutsideDays={showOutsideDays}
      className={cn(
        "group/calendar w-[min(var(--calendar-width),calc(100vw-var(--space-8)))] max-w-full bg-background p-[var(--space-2)] [--cell-radius:var(--radius-control)] [--cell-size:var(--control-height-md)] in-data-[slot=card-content]:bg-transparent in-data-[slot=popover-content]:bg-transparent",
        String.raw`rtl:**:[.rdp-button\_next>svg]:rotate-180`,
        String.raw`rtl:**:[.rdp-button\_previous>svg]:rotate-180`,
        className
      )}
      captionLayout={captionLayout}
      locale={locale}
      formatters={{
        formatMonthDropdown: (date) =>
          date.toLocaleString(locale?.code, { month: "short" }),
        ...formatters,
      }}
      classNames={{
        root: cn("w-full", defaultClassNames.root),
        months: cn(
          "relative flex flex-col gap-[var(--space-4)] md:flex-row",
          defaultClassNames.months
        ),
        month: cn("flex w-full flex-col gap-[var(--space-4)]", defaultClassNames.month),
        nav: cn(
          "absolute inset-x-0 top-0 flex w-full items-center justify-between gap-[var(--space-1)]",
          defaultClassNames.nav
        ),
        button_previous: cn(
          buttonVariants({ variant: buttonVariant }),
          "size-[var(--cell-size)] p-0 select-none aria-disabled:opacity-[var(--disabled-opacity)]",
          defaultClassNames.button_previous
        ),
        button_next: cn(
          buttonVariants({ variant: buttonVariant }),
          "size-[var(--cell-size)] p-0 select-none aria-disabled:opacity-[var(--disabled-opacity)]",
          defaultClassNames.button_next
        ),
        month_caption: cn(
          "flex h-[var(--cell-size)] w-full items-center justify-center px-[var(--cell-size)]",
          defaultClassNames.month_caption
        ),
        dropdowns: cn(
          "flex h-[var(--cell-size)] w-full items-center justify-center gap-[var(--space-1)] text-[var(--font-size-md)] font-medium",
          defaultClassNames.dropdowns
        ),
        dropdown_root: cn(
          "relative rounded-[var(--cell-radius)]",
          defaultClassNames.dropdown_root
        ),
        dropdown: cn(
          "absolute inset-0 bg-popover opacity-0",
          defaultClassNames.dropdown
        ),
        caption_label: cn(
          "font-medium select-none",
          captionLayout === "label"
            ? "text-[var(--font-size-sm)] leading-[var(--line-height-sm)]"
            : "flex items-center gap-[var(--space-1)] rounded-[var(--cell-radius)] text-[var(--font-size-md)] [&>svg]:size-[var(--icon-size-sm)] [&>svg]:text-muted-foreground",
          defaultClassNames.caption_label
        ),
        month_grid: cn("w-full border-collapse", defaultClassNames.month_grid),
        weekdays: cn("flex", defaultClassNames.weekdays),
        weekday: cn(
          "flex-1 rounded-[var(--cell-radius)] text-[var(--font-size-sm)] font-normal text-muted-foreground select-none",
          defaultClassNames.weekday
        ),
        week: cn("mt-[var(--space-2)] flex w-full", defaultClassNames.week),
        week_number_header: cn(
          "w-[var(--cell-size)] select-none",
          defaultClassNames.week_number_header
        ),
        week_number: cn(
          "text-[var(--font-size-sm)] text-muted-foreground select-none",
          defaultClassNames.week_number
        ),
        day: cn(
          "group/day relative aspect-square h-full w-full rounded-[var(--cell-radius)] p-0 text-center select-none [&:last-child[data-selected=true]_button]:rounded-r-[var(--cell-radius)]",
          props.showWeekNumber
            ? "[&:nth-child(2)[data-selected=true]_button]:rounded-l-[var(--cell-radius)]"
            : "[&:first-child[data-selected=true]_button]:rounded-l-[var(--cell-radius)]",
          defaultClassNames.day
        ),
        range_start: cn(
          "relative isolate z-0 rounded-l-[var(--cell-radius)] bg-surface-selected after:absolute after:inset-y-0 after:right-0 after:w-[var(--space-4)] after:bg-surface-selected",
          defaultClassNames.range_start
        ),
        range_middle: cn("rounded-none", defaultClassNames.range_middle),
        range_end: cn(
          "relative isolate z-0 rounded-r-[var(--cell-radius)] bg-surface-selected after:absolute after:inset-y-0 after:left-0 after:w-[var(--space-4)] after:bg-surface-selected",
          defaultClassNames.range_end
        ),
        today: cn(
          "rounded-[var(--cell-radius)] bg-primary-subtle text-primary data-[selected=true]:rounded-none",
          defaultClassNames.today
        ),
        outside: cn(
          "text-muted-foreground aria-selected:text-muted-foreground",
          defaultClassNames.outside
        ),
        disabled: cn(
          "text-muted-foreground opacity-[var(--disabled-opacity)]",
          defaultClassNames.disabled
        ),
        hidden: cn("invisible", defaultClassNames.hidden),
        ...classNames,
      }}
      components={{
        Root: ({ className, rootRef, ...props }) => {
          return (
            <div
              data-slot="calendar"
              ref={rootRef}
              className={cn(className)}
              {...props}
            />
          )
        },
        Chevron: ({ className, orientation, ...props }) => {
          if (orientation === "left") {
            return (
              <ChevronLeftIcon className={cn("size-[var(--icon-size-md)]", className)} {...props} />
            )
          }

          if (orientation === "right") {
            return (
              <ChevronRightIcon className={cn("size-[var(--icon-size-md)]", className)} {...props} />
            )
          }

          return (
            <ChevronDownIcon className={cn("size-[var(--icon-size-md)]", className)} {...props} />
          )
        },
        DayButton: ({ ...props }) => (
          <CalendarDayButton locale={locale} {...props} />
        ),
        WeekNumber: ({ children, ...props }) => {
          return (
            <td {...props}>
              <div className="flex size-[var(--cell-size)] items-center justify-center text-center">
                {children}
              </div>
            </td>
          )
        },
        ...components,
      }}
      {...props}
    />
  )
}

function CalendarDayButton({
  className,
  day,
  modifiers,
  locale,
  ...props
}: React.ComponentProps<typeof DayButton> & { locale?: Partial<Locale> }) {
  const defaultClassNames = getDefaultClassNames()

  const ref = React.useRef<HTMLButtonElement>(null)
  React.useEffect(() => {
    if (modifiers.focused) ref.current?.focus()
  }, [modifiers.focused])

  return (
    <Button
      ref={ref}
      variant="ghost"
      size="icon"
      data-day={day.date.toLocaleDateString(locale?.code)}
      data-selected-single={
        modifiers.selected &&
        !modifiers.range_start &&
        !modifiers.range_end &&
        !modifiers.range_middle
      }
      data-range-start={modifiers.range_start}
      data-range-end={modifiers.range_end}
      data-range-middle={modifiers.range_middle}
      className={cn(
        "relative isolate z-10 flex aspect-square size-auto w-full min-w-[var(--cell-size)] flex-col gap-[var(--space-1)] border-0 leading-none font-normal group-data-[focused=true]/day:relative group-data-[focused=true]/day:z-10 group-data-[focused=true]/day:border-ring group-data-[focused=true]/day:[--tw-ring-width:var(--focus-ring-width)] group-data-[focused=true]/day:ring-ring group-data-[focused=true]/day:ring-offset-background data-[range-end=true]:rounded-[var(--cell-radius)] data-[range-end=true]:rounded-r-[var(--cell-radius)] data-[range-end=true]:bg-primary data-[range-end=true]:text-primary-foreground data-[range-middle=true]:rounded-none data-[range-middle=true]:bg-surface-selected data-[range-middle=true]:text-foreground data-[range-start=true]:rounded-[var(--cell-radius)] data-[range-start=true]:rounded-l-[var(--cell-radius)] data-[range-start=true]:bg-primary data-[range-start=true]:text-primary-foreground data-[selected-single=true]:bg-primary data-[selected-single=true]:text-primary-foreground hover:bg-surface-hover dark:hover:text-foreground [&>span]:text-[var(--font-size-xs)] [&>span]:opacity-70",
        defaultClassNames.day,
        className
      )}
      {...props}
    />
  )
}

export { Calendar, CalendarDayButton }
