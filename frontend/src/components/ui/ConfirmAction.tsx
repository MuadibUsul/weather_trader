import Button from './Button'

type Props = {
  label: string
  confirmText: string
  onConfirm: () => Promise<void> | void
  disabled?: boolean
  variant?: 'danger' | 'secondary' | 'ghost'
  className?: string
}

export default function ConfirmAction({
  label,
  confirmText,
  onConfirm,
  disabled = false,
  variant = 'danger',
  className = '',
}: Props) {
  const handleClick = async () => {
    if (disabled) return
    const ok = window.confirm(confirmText)
    if (!ok) return
    await onConfirm()
  }

  return (
    <Button type="button" variant={variant} className={className} onClick={handleClick} disabled={disabled}>
      {label}
    </Button>
  )
}
