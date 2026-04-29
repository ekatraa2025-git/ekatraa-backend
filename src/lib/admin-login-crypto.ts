import { constants, createDecipheriv, createPrivateKey, privateDecrypt } from 'crypto'

/** v1 wire format from client (base64url fields). */
export type EncryptedLoginBodyV1 = {
    v: 1
    wrappedKey: string
    iv: string
    ciphertext: string
    tag: string
}

function isRecord(v: unknown): v is Record<string, unknown> {
    return typeof v === 'object' && v !== null
}

export function isEncryptedLoginBodyV1(body: unknown): body is EncryptedLoginBodyV1 {
    if (!isRecord(body)) return false
    return (
        body.v === 1 &&
        typeof body.wrappedKey === 'string' &&
        typeof body.iv === 'string' &&
        typeof body.ciphertext === 'string' &&
        typeof body.tag === 'string'
    )
}

export function decryptAdminLoginPayload(
    privateKeyPem: string,
    body: EncryptedLoginBodyV1
): { email: string; password: string } {
    const privateKey = createPrivateKey(privateKeyPem)
    const aesKey = privateDecrypt(
        {
            key: privateKey,
            padding: constants.RSA_PKCS1_OAEP_PADDING,
            oaepHash: 'sha256',
        },
        Buffer.from(body.wrappedKey, 'base64url')
    )
    if (aesKey.length !== 32) {
        throw new Error('Invalid decrypted key length')
    }
    const iv = Buffer.from(body.iv, 'base64url')
    const ciphertext = Buffer.from(body.ciphertext, 'base64url')
    const tag = Buffer.from(body.tag, 'base64url')
    const decipher = createDecipheriv('aes-256-gcm', aesKey, iv)
    decipher.setAuthTag(tag)
    const plain = Buffer.concat([decipher.update(ciphertext), decipher.final()])
    const parsed = JSON.parse(plain.toString('utf8')) as unknown
    if (!isRecord(parsed)) throw new Error('Invalid login payload')
    const email = parsed.email
    const password = parsed.password
    if (typeof email !== 'string' || typeof password !== 'string') {
        throw new Error('Invalid login payload fields')
    }
    return { email, password }
}
