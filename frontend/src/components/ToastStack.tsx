type NoticeKind = 'success' | 'error' | 'info'

export type ToastItem = {
  id: number
  kind: NoticeKind
  message: string
}

type Props = {
  toasts: ToastItem[]
  onDismiss: (id: number) => void
}

export default function ToastStack({ toasts, onDismiss }: Props) {
  return (
    <div className="toast-stack" aria-live="polite" aria-atomic="false">
      {toasts.map((toast) => (
        <div key={toast.id} className={`toast ${toast.kind}`}>
          <span>{toast.message}</span>
          <button type="button" onClick={() => onDismiss(toast.id)}>×</button>
        </div>
      ))}
    </div>
  )
}
