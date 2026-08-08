import { useEffect, useId, useRef } from 'react'

const FOCUSABLE = [
  'button:not([disabled])',
  'input:not([disabled])',
  'select:not([disabled])',
  'textarea:not([disabled])',
  '[href]',
  '[tabindex]:not([tabindex="-1"])',
].join(',')

export function Dialog({ open, title, description, onClose, children }) {
  const titleId = useId()
  const descriptionId = useId()
  const dialogRef = useRef(null)
  const restoreFocusRef = useRef(null)

  useEffect(() => {
    if (!open) return undefined
    restoreFocusRef.current = document.activeElement
    const dialog = dialogRef.current
    const focusable = [...dialog.querySelectorAll(FOCUSABLE)]
    const initial = dialog.querySelector('[data-autofocus]') || focusable[0] || dialog
    initial.focus()

    function onKeyDown(event) {
      if (event.key === 'Escape') {
        event.preventDefault()
        onClose()
        return
      }
      if (event.key !== 'Tab') return
      const items = [...dialog.querySelectorAll(FOCUSABLE)]
      if (items.length === 0) {
        event.preventDefault()
        dialog.focus()
        return
      }
      const first = items[0]
      const last = items.at(-1)
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault()
        last.focus()
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault()
        first.focus()
      }
    }

    document.addEventListener('keydown', onKeyDown)
    return () => {
      document.removeEventListener('keydown', onKeyDown)
      restoreFocusRef.current?.focus?.()
    }
  }, [onClose, open])

  if (!open) return null
  return (
    <div
      className="rt-dialog-backdrop"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) onClose()
      }}
    >
      <section
        className="rt-dialog"
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        aria-describedby={description ? descriptionId : undefined}
        tabIndex={-1}
      >
        <header className="rt-dialog__head">
          <div>
            <h2 id={titleId}>{title}</h2>
            {description ? <p id={descriptionId}>{description}</p> : null}
          </div>
          <button className="rt-dialog__close" type="button" onClick={onClose} aria-label="关闭弹窗">
            ×
          </button>
        </header>
        {children}
      </section>
    </div>
  )
}

export function FormField({ label, error, full = false, children }) {
  return (
    <label className={`rt-form-field ${full ? 'is-full' : ''}`}>
      <span>{label}</span>
      {children}
      {error ? <small role="alert">{error}</small> : null}
    </label>
  )
}
