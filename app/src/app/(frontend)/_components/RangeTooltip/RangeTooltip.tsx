import styles from './RangeTooltip.module.css'

type RangeTooltipProps = {
  id: string
  message: string
}

export default function RangeTooltip({ id, message }: RangeTooltipProps) {
  return <div className={styles.tooltip} id={id} role="tooltip">{message}</div>
}
