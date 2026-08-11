'use client'

import { FieldDescription, FieldLabel } from '@payloadcms/ui'
import { createPortal } from 'react-dom'
import type { ComponentProps, CSSProperties } from 'react'
import { useCallback, useId, useLayoutEffect, useRef, useState } from 'react'

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
  const tooltipId = `payload-field-help-${useId().replaceAll(':', '')}`
  const buttonRef = useRef<HTMLButtonElement>(null)
  const tooltipRef = useRef<HTMLDivElement>(null)
  const [isHovered, setIsHovered] = useState(false)
  const [isFocused, setIsFocused] = useState(false)
  const [tooltipPosition, setTooltipPosition] = useState<
    { top: number; left: number; placement: 'above' | 'below' } | undefined
  >()
  const isTooltipVisible = isHovered || isFocused

  const updateTooltipPosition = useCallback(() => {
    const button = buttonRef.current
    const tooltip = tooltipRef.current

    if (!button || !tooltip) return

    const buttonRect = button.getBoundingClientRect()
    const tooltipRect = tooltip.getBoundingClientRect()
    const viewportPadding = 8
    const gap = 8
    const aboveTop = buttonRect.top - tooltipRect.height - gap
    const belowTop = buttonRect.bottom + gap
    const canPlaceAbove = aboveTop >= viewportPadding
    const canPlaceBelow = belowTop + tooltipRect.height <= window.innerHeight - viewportPadding
    const placement = !canPlaceAbove && canPlaceBelow ? 'below' : 'above'
    const rawTop = placement === 'below' ? belowTop : aboveTop
    const maxTop = Math.max(viewportPadding, window.innerHeight - tooltipRect.height - viewportPadding)
    const top = Math.min(Math.max(rawTop, viewportPadding), maxTop)
    const maxLeft = Math.max(viewportPadding, window.innerWidth - tooltipRect.width - viewportPadding)
    const centeredLeft = buttonRect.left + (buttonRect.width - tooltipRect.width) / 2
    const left = Math.min(Math.max(centeredLeft, viewportPadding), maxLeft)

    setTooltipPosition((current) => {
      if (
        current &&
        current.top === top &&
        current.left === left &&
        current.placement === placement
      ) {
        return current
      }

      return { top, left, placement }
    })
  }, [])

  useLayoutEffect(() => {
    if (!isTooltipVisible) {
      setTooltipPosition(undefined)
      return
    }

    updateTooltipPosition()
    window.addEventListener('resize', updateTooltipPosition)
    window.addEventListener('scroll', updateTooltipPosition, true)

    return () => {
      window.removeEventListener('resize', updateTooltipPosition)
      window.removeEventListener('scroll', updateTooltipPosition, true)
    }
  }, [isTooltipVisible, updateTooltipPosition])

  if (typeof description !== 'string' || !description) {
    return <FieldLabel {...labelProps} />
  }

  const labelText = typeof labelProps.label === 'string' ? labelProps.label : '字段'

  const portalTooltip =
    isTooltipVisible && typeof document !== 'undefined'
      ? createPortal(
          <div
            ref={tooltipRef}
            id={tooltipId}
            className={`payload-field-help__bubble payload-field-help__bubble--portal${
              tooltipPosition?.placement === 'below'
                ? ' payload-field-help__bubble--below'
                : ''
            }`}
            role="tooltip"
            style={
              tooltipPosition
                ? {
                    left: tooltipPosition.left,
                    top: tooltipPosition.top,
                  }
                : ({ left: 0, top: 0, visibility: 'hidden' } as CSSProperties)
            }
          >
            {description}
          </div>,
          document.body,
        )
      : null

  return (
    <>
      <span className="payload-tooltip-field-label">
        <FieldLabel {...labelProps} />
        <button
          ref={buttonRef}
          type="button"
          className="payload-field-help"
          aria-describedby={isTooltipVisible ? tooltipId : undefined}
          aria-label={`查看${labelText}说明`}
          onBlur={() => setIsFocused(false)}
          onFocus={() => setIsFocused(true)}
          onMouseEnter={() => setIsHovered(true)}
          onMouseLeave={() => setIsHovered(false)}
        >
          <span aria-hidden="true">?</span>
        </button>
      </span>
      {portalTooltip}
    </>
  )
}

export function TooltipFieldDescription(_props: TooltipFieldDescriptionProps) {
  return null
}
