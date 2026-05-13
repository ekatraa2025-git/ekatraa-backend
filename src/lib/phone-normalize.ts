/** Last 10 digits for India-style numbers. */
export function normalizePhoneDigits(value: string | null | undefined): string {
    return String(value || '')
        .replace(/\D/g, '')
        .slice(-10)
}
