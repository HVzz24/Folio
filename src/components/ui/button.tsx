import { Button as BaseButton } from '@base-ui/react/button'
import { forwardRef, type ComponentProps } from 'react'
import { cn } from '@/lib/utils'

type ButtonVariant = 'default' | 'secondary' | 'outline' | 'ghost' | 'destructive' | 'link'
type ButtonSize = 'default' | 'sm' | 'lg' | 'icon'

type ButtonProps = Omit<ComponentProps<typeof BaseButton>, 'className'> & {
  className?: string
  variant?: ButtonVariant
  size?: ButtonSize
}

export const Button = forwardRef<HTMLElement, ButtonProps>(function Button({
  className,
  variant = 'default',
  size = 'default',
  ...props
}, ref) {
  return (
    <BaseButton
      ref={ref}
      className={cn('ui-button', `ui-button-${variant}`, `ui-button-${size}`, className)}
      {...props}
    />
  )
})
