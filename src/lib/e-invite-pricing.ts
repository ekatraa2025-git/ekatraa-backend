/** Fixed retail prices (INR) for AI e-invites — app + checkout must match. */
export const E_INVITE_STATIC_INR = 300
export const E_INVITE_ANIMATED_INR = 500

export type EInviteMediaKind = 'static' | 'animated'

export function priceInrForMediaKind(kind: EInviteMediaKind): number {
    return kind === 'animated' ? E_INVITE_ANIMATED_INR : E_INVITE_STATIC_INR
}
