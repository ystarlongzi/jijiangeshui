'use client'

import { FieldDescription, FieldLabel } from '@payloadcms/ui'
import type { ComponentProps } from 'react'

type TooltipFieldDescriptionProps = ComponentProps<typeof FieldDescription>
type FieldLabelProps = ComponentProps<typeof FieldLabel>

type TooltipFieldLabelProps = Record<string, unknown>

type FieldWithTooltip = {
  label?: FieldLabelProps['label']
  localized?: FieldLabelProps['localized']
  required?: FieldLabelProps['required']
  admin?: {
    custom?: {
      tooltip?: unknown
    }
  }
}

export function TooltipFieldLabel(props: TooltipFieldLabelProps) {
  const { field, ...rest } = props
  const clientField = field as FieldWithTooltip | undefined
  const baseLabelProps = rest as FieldLabelProps
  // Payload 传入的是 client field，而不是默认 FieldLabel 的完整 props，需要从字段配置补回 label。
  const labelProps: FieldLabelProps = {
    ...baseLabelProps,
    label: baseLabelProps.label ?? clientField?.label,
    localized: baseLabelProps.localized ?? clientField?.localized,
    required: baseLabelProps.required ?? clientField?.required,
  }
  const description = clientField?.admin?.custom?.tooltip

  if (typeof description !== 'string' || !description) {
    return <FieldLabel {...labelProps} />
  }

  const labelText = typeof labelProps.label === 'string' ? labelProps.label : '字段'

  return (
    <span className="payload-tooltip-field-label">
      <FieldLabel {...labelProps} />
      <button
        type="button"
        className="payload-field-help"
        aria-label={`查看${labelText}说明`}
      >
        <span aria-hidden="true">?</span>
        <span className="payload-field-help__bubble" role="tooltip">
          {description}
        </span>
      </button>
    </span>
  )
}

export function TooltipFieldDescription(_props: TooltipFieldDescriptionProps) {
  return null
}
