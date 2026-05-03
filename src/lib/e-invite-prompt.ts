export type EInviteDesignInput = {
    color_theme?: string
    variation?: string
    font_style?: string
    sticker_pack?: string
}

const COLOR_WORDS: Record<string, string> = {
    rose: 'rose blush, warm pink highlights, romantic highlights',
    gold: 'warm ivory, antique gold foil accents, soft champagne light',
    navy: 'deep navy contrast, crisp white type, subtle silver accents',
    emerald: 'deep green foliage touches, cream base, festive depth',
    royal: 'regal violet-plum undertones, ornate borders, premium tone',
}

const FONT_HINTS: Record<string, string> = {
    classic_serif: 'classic editorial serif headline, refined letter spacing, high legibility',
    elegant_script: 'tasteful calligraphic script for names, paired with minimal supporting text',
    bold_modern_sans: 'bold geometric sans-serif, large confident heading',
    indian_calligraphy: 'Indian festive calligraphy energy, ornate but readable titles',
}

const STICKER_HINTS: Record<string, string> = {
    floral_mogra: 'delicate jasmine / mogra floral corners, fine botanical line-work',
    kalash_diya: 'subtle kalash, diya, and auspicious motifs as corner ornaments',
    peacock_elephant: 'peacock feather hints and regal elephant motif line art, not cartoon',
    confetti_sparkle: 'soft bokeh lights and light confetti accents, not clashing colors',
    minimal_none: 'very light corner flourishes only; keep whitespace generous',
}

export function buildEInviteImagePrompt(input: {
    occasion: string
    userPrompt: string
    eventName: string
    hostNames?: string
    eventDate?: string
    eventTime?: string
    venue?: string
    design: EInviteDesignInput
    compositionHint?: string
}): string {
    const d = input.design || {}
    const color = COLOR_WORDS[String(d.color_theme || '').toLowerCase()] || String(d.color_theme || 'refined palette')
    const variation = String(d.variation || 'classic').toLowerCase()
    const font = FONT_HINTS[String(d.font_style || '').toLowerCase()] || FONT_HINTS.classic_serif
    const sticker = STICKER_HINTS[String(d.sticker_pack || '').toLowerCase()] || STICKER_HINTS.floral_mogra

    const lines = [
        `Create a premium invitation card image for a ${input.occasion} celebration — vertical portrait layout, print-ready typography.`,
        `Event title on card: "${input.eventName}".`,
    ]
    if (input.hostNames) lines.push(`Hosts line: "${input.hostNames}".`)
    if (input.eventDate) lines.push(`Date: ${input.eventDate}${input.eventTime ? ` at ${input.eventTime}` : ''}.`)
    if (input.venue) lines.push(`Venue: ${input.venue}.`)
    lines.push(
        `Overall style: ${variation} — refined South-Asian / Indian luxury invite aesthetic suitable for WhatsApp sharing.`,
        `Color direction: ${color}.`,
        `Typography direction: ${font}.`,
        `Decorative accents: ${sticker}.`,
        `Creative direction from user: ${input.userPrompt || 'elegant, timeless, joyful'}.`,
    )
    if (input.compositionHint) lines.push(input.compositionHint)
    lines.push(
        'No QR codes, no watermarks, no mock browser frames. High resolution look; clear focal title; balanced margins.',
    )
    return lines.join('\n')
}
