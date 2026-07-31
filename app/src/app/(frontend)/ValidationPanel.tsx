type ValidationPanelProps = {
  messages: string[]
  title?: string
}

export default function ValidationPanel({ messages, title = '请先确认这些输入' }: ValidationPanelProps) {
  if (messages.length === 0) return null
  return <div className="validation-panel" role="alert" aria-live="polite">
    <strong>{title}</strong>
    <ul>{messages.map((message) => <li key={message}>{message}</li>)}</ul>
  </div>
}
