import { useMemo, useState } from 'react'
import { useI18n } from '../../i18n'
import Button from './Button'

type Props = {
  value: string
  className?: string
  revealOnHover?: boolean
  copyable?: boolean
}

function middleEllipsis(value: string, head = 8, tail = 6): string {
  if (!value) return ''
  if (value.length <= head + tail + 3) return value
  return `${value.slice(0, head)}...${value.slice(-tail)}`
}

export default function CopyableText({ value, className = '', revealOnHover = true, copyable = true }: Props) {
  const { t } = useI18n()
  const [copied, setCopied] = useState(false)

  const display = useMemo(() => middleEllipsis(value), [value])

  const copy = async () => {
    if (!copyable || !value) return
    try {
      await navigator.clipboard.writeText(value)
      setCopied(true)
      setTimeout(() => setCopied(false), 1500)
    } catch {
      setCopied(false)
    }
  }

  return (
    <span className={`copyable ${className}`.trim()} title={revealOnHover ? value : undefined}>
      <code className="copyable-text">{display}</code>
      {copyable && (
        <Button
          type="button"
          variant="ghost"
          className="copyable-btn"
          onClick={copy}
          aria-label={copied ? t('common.copied') : t('common.copy')}
          title={copied ? t('common.copied') : t('common.copy')}
        >
          {copied ? t('common.copied') : t('common.copy')}
        </Button>
      )}
    </span>
  )
}
