"use client"

import { Popover as BasePopover } from '@base-ui/react/popover'
import { format } from 'date-fns'
import { CalendarIcon } from 'lucide-react'
import { forwardRef, useState, type ButtonHTMLAttributes, type PropsWithChildren } from 'react'
import { DayPicker as Calendar, type DateRange } from 'react-day-picker'
import 'react-day-picker/style.css'

const Popover = BasePopover.Root
const PopoverTrigger = BasePopover.Trigger

const Button = forwardRef<HTMLButtonElement, ButtonHTMLAttributes<HTMLButtonElement>>(
  function Button(props, ref) {
    return <button ref={ref} {...props} />
  },
)

function PopoverContent({ children }: PropsWithChildren) {
  return (
    <BasePopover.Portal>
      <BasePopover.Positioner className="date-range-positioner" sideOffset={5}>
        <BasePopover.Popup className="date-range-popover">{children}</BasePopover.Popup>
      </BasePopover.Positioner>
    </BasePopover.Portal>
  )
}

export function DateRangePicker({ range, setRange }: {
  range: DateRange | undefined
  setRange: (range: DateRange | undefined) => void
}) {
  const [open, setOpen] = useState(false)
  const label = range?.from
    ? range.to
      ? `${format(range.from, 'LLL dd, y')} – ${format(range.to, 'LLL dd, y')}`
      : `${format(range.from, 'LLL dd, y')} – Pick an end date`
    : range?.to
      ? `Pick a start date – ${format(range.to, 'LLL dd, y')}`
      : 'Pick a date range'

  function handleRangeChange(nextRange: DateRange | undefined) {
    setRange(nextRange)
    if (nextRange?.from && nextRange.to) setOpen(false)
  }

  return (
    <div className="field field-wide date-range-picker">
      <span>Start and end dates</span>
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger
          render={<Button type="button" className="date-range-trigger" />}
        >
          <CalendarIcon size={15} aria-hidden="true" />
          <span>{label}</span>
        </PopoverTrigger>
        <PopoverContent>
          <Calendar
            mode="range"
            selected={range}
            onSelect={handleRangeChange}
            defaultMonth={range?.from ?? range?.to}
            numberOfMonths={1}
            resetOnSelect
            className="date-range-calendar"
          />
        </PopoverContent>
      </Popover>
    </div>
  )
}
