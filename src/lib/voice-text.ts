export function toSpeechSafeText(raw: string, maxLen = 3500): string {
    const input = String(raw || '')
    const noCart = input.replace(/(?:^|\n)CART_ACTIONS:(\{[\s\S]*\})\s*$/m, '').trim()
    return noCart
        .replace(/\*\*?|__|`+/g, ' ')
        .replace(/^#{1,6}\s+/gm, '')
        .replace(/\[([^\]]+)\]\([^)]+\)/g, '$1')
        .replace(/\|/g, ' ')
        .replace(/\s+/g, ' ')
        .trim()
        .slice(0, maxLen)
}
