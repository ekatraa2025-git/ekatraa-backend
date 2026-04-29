/**
 * Browser-only helpers for encrypting admin login credentials (RSA-OAEP wraps AES-256-GCM).
 */

export type EncryptedLoginBodyV1 = {
    v: 1
    wrappedKey: string
    iv: string
    ciphertext: string
    tag: string
}

function pemSpkiToBinary(pem: string): ArrayBuffer {
    const b64 = pem
        .replace(/-----BEGIN PUBLIC KEY-----/i, '')
        .replace(/-----END PUBLIC KEY-----/i, '')
        .replace(/\s/g, '')
    const binary = atob(b64)
    const bytes = new Uint8Array(binary.length)
    for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i)
    return bytes.buffer
}

function uint8ToBase64url(bytes: Uint8Array): string {
    let binary = ''
    for (let i = 0; i < bytes.length; i++) binary += String.fromCharCode(bytes[i])
    return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
}

export async function encryptAdminLoginPayload(
    publicKeyPem: string,
    email: string,
    password: string
): Promise<EncryptedLoginBodyV1> {
    const spki = pemSpkiToBinary(publicKeyPem)
    const publicKey = await crypto.subtle.importKey(
        'spki',
        spki,
        { name: 'RSA-OAEP', hash: 'SHA-256' },
        false,
        ['encrypt']
    )

    const aesKey = await crypto.subtle.generateKey({ name: 'AES-GCM', length: 256 }, true, ['encrypt'])
    const iv = crypto.getRandomValues(new Uint8Array(12))
    const plaintext = new TextEncoder().encode(JSON.stringify({ email, password }))

    const cipherFull = await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, aesKey, plaintext)
    const full = new Uint8Array(cipherFull)
    const tag = full.slice(-16)
    const ciphertext = full.slice(0, -16)

    const rawAes = await crypto.subtle.exportKey('raw', aesKey)
    const wrappedKey = await crypto.subtle.encrypt({ name: 'RSA-OAEP' }, publicKey, rawAes)

    return {
        v: 1,
        wrappedKey: uint8ToBase64url(new Uint8Array(wrappedKey)),
        iv: uint8ToBase64url(iv),
        ciphertext: uint8ToBase64url(ciphertext),
        tag: uint8ToBase64url(tag),
    }
}
