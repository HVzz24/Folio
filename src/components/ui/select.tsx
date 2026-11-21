import { Select as BaseSelect } from '@base-ui/react/select'
import { Check, ChevronDown } from 'lucide-react'
import { cn } from '@/lib/utils'

export type SelectOption = { value: string; label: string }

export function Select({ value, options, onValueChange, 'aria-label': ariaLabel }: {
  value: string
  options: SelectOption[]
  onValueChange: (value: string) => void
  'aria-label': string
}) {
  return (
    <BaseSelect.Root
      value={value}
      onValueChange={(nextValue) => {
        if (typeof nextValue === 'string') onValueChange(nextValue)
      }}
    >
      <BaseSelect.Trigger className="ui-select-trigger" aria-label={ariaLabel}>
        <BaseSelect.Value />
        <ChevronDown size={14} aria-hidden="true" />
      </BaseSelect.Trigger>
      <BaseSelect.Portal>
        <BaseSelect.Positioner className="ui-select-positioner" sideOffset={4}>
          <BaseSelect.Popup className="ui-select-popup">
            <BaseSelect.List>
              {options.map((option) => (
                <BaseSelect.Item
                  key={option.value}
                  className={cn('ui-select-item')}
                  value={option.value}
                >
                  <span>{option.label}</span>
                  <BaseSelect.ItemIndicator className="ui-select-indicator">
                    <Check size={14} />
                  </BaseSelect.ItemIndicator>
                </BaseSelect.Item>
              ))}
            </BaseSelect.List>
          </BaseSelect.Popup>
        </BaseSelect.Positioner>
      </BaseSelect.Portal>
    </BaseSelect.Root>
  )
}
