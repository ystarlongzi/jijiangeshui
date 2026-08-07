export async function copyText(text: string) {
  await navigator.clipboard.writeText(text)
}

export function resultLines(lines: Array<string | false | null | undefined>) {
  return lines.filter(Boolean).join('\n')
}
