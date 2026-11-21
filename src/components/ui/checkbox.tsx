import { Checkbox as BaseCheckbox } from '@base-ui/react/checkbox'
import { Check } from 'lucide-react'
import type { ComponentProps } from 'react'
import { cn } from '@/lib/utils'

type CheckboxProps = Omit<ComponentProps<typeof BaseCheckbox.Root>, 'className' | 'children'> & {
  className?: string
}

export function Checkbox({ className, ...props }: CheckboxProps) {
  return (
    <BaseCheckbox.Root className={cn('ui-checkbox', className)} {...props}>
      <BaseCheckbox.Indicator className="ui-checkbox-indicator">
        <Check size={12} strokeWidth={2.5} />
      </BaseCheckbox.Indicator>
    </BaseCheckbox.Root>
  )
}
