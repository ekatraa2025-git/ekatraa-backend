import { supabase } from '@/lib/supabase/server'

export type VendorAiChannel = 'app' | 'whatsapp'
export type VendorAiLanguage = 'en' | 'hi' | 'bn' | 'or'

export type VendorAiIntent =
    | 'payment_query'
    | 'booking_query'
    | 'app_usage'
    | 'profile_listing'
    | 'client_communication'
    | 'general'

export type VendorAiUsefulInfo = {
    intent: VendorAiIntent
    resolved: boolean
}

type LogTurnInput = {
    vendorId: string
    threadId: string
    channel: VendorAiChannel
    language?: VendorAiLanguage
    userMessage: string
    assistantReply: string
    tokensUsed?: number | null
    agentOutput?: unknown
}

const DEVANAGARI = /[\u0900-\u097F]/
const BENGALI = /[\u0980-\u09FF]/
const ODIA = /[\u0B00-\u0B7F]/

export function inferDetectedLanguage(text: string, preferred?: VendorAiLanguage): VendorAiLanguage {
    if (preferred) return preferred
    const sample = text.trim()
    if (!sample) return 'en'
    if (ODIA.test(sample)) return 'or'
    if (BENGALI.test(sample)) return 'bn'
    if (DEVANAGARI.test(sample)) return 'hi'
    return 'en'
}

export function inferVendorAiIntent(message: string): VendorAiIntent {
    const m = message.toLowerCase()
    if (/payment|payout|commission|fee|gst|invoice|upi|bank|billing|paisa|bhugtan|টাকা|ପେମେଣ୍ଟ/.test(m)) {
        return 'payment_query'
    }
    if (/book|calendar|busy|available|reschedule|decline|accept|slot|date block|booking|availability|बुकिंग|বুকিং|ବୁକିଂ/.test(m)) {
        return 'booking_query'
    }
    if (/profile|listing|photo|video|package|verify|visibility|description|pricing|portfolio|प्रोफाइल|প্রোফাইল|ପ୍ରୋଫାଇଲ/.test(m)) {
        return 'profile_listing'
    }
    if (/client|customer|enquiry|inquiry|quote|proposal|cancel|dispute|communication|ग्राहक|ক্লায়েন্ট|ଗ୍ରାହକ/.test(m)) {
        return 'client_communication'
    }
    if (/login|otp|crash|not working|navigate|screen|app|troubleshoot|लॉगिन|লগইন|ଲଗଇନ/.test(m)) {
        return 'app_usage'
    }
    return 'general'
}

function inferResolved(assistantReply: string): boolean {
    const reply = assistantReply.toLowerCase()
    if (
        reply.includes('support team directly') ||
        reply.includes("don't have that exact detail") ||
        reply.includes('contact ekatraa support')
    ) {
        return false
    }
    return true
}

export function buildUsefulInfoExtracted(userMessage: string, assistantReply: string): VendorAiUsefulInfo {
    return {
        intent: inferVendorAiIntent(userMessage),
        resolved: inferResolved(assistantReply),
    }
}

function buildSummary(userMessage: string, intent: VendorAiIntent): string {
    const trimmed = userMessage.replace(/\s+/g, ' ').trim()
    const preview = trimmed.length > 100 ? `${trimmed.slice(0, 97)}…` : trimmed
    const intentLabel: Record<VendorAiIntent, string> = {
        payment_query: 'payment',
        booking_query: 'booking/calendar',
        app_usage: 'app usage',
        profile_listing: 'profile/listing',
        client_communication: 'client communication',
        general: 'general',
    }
    return `Vendor asked about ${intentLabel[intent]}: ${preview}`
}

export function extractTokensUsed(out: unknown): number | null {
    if (!out || typeof out !== 'object') return null
    const usage = (out as { usage?: { totalTokens?: number; promptTokens?: number; completionTokens?: number } }).usage
    if (typeof usage?.totalTokens === 'number') return usage.totalTokens
    const prompt = usage?.promptTokens ?? 0
    const completion = usage?.completionTokens ?? 0
    if (prompt + completion > 0) return prompt + completion
    return null
}

/** Persist one user→assistant turn. Failures are logged but never thrown to callers. */
export async function logVendorAiConversationTurn(input: LogTurnInput): Promise<void> {
    try {
        const detectedLanguage = inferDetectedLanguage(input.userMessage, input.language)
        const intent = inferVendorAiIntent(input.userMessage)
        const usefulInfo = buildUsefulInfoExtracted(input.userMessage, input.assistantReply)
        const summary = buildSummary(input.userMessage, intent)
        const tokensUsed =
            typeof input.tokensUsed === 'number' ? input.tokensUsed : extractTokensUsed(input.agentOutput)

        const { data: conversation, error: upsertError } = await supabase
            .from('vendor_ai_conversations')
            .upsert(
                {
                    vendor_id: input.vendorId,
                    thread_id: input.threadId,
                    channel: input.channel,
                    language: input.language ?? detectedLanguage,
                    summary,
                    useful_info_extracted: usefulInfo,
                    updated_at: new Date().toISOString(),
                },
                { onConflict: 'vendor_id,thread_id' }
            )
            .select('id')
            .single()

        if (upsertError || !conversation?.id) {
            console.error('[vendor-ai-log] conversation upsert failed:', upsertError?.message)
            return
        }

        const conversationId = conversation.id as string
        const { error: messagesError } = await supabase.from('vendor_ai_messages').insert([
            {
                conversation_id: conversationId,
                role: 'user',
                text: input.userMessage.slice(0, 8000),
                detected_language: detectedLanguage,
            },
            {
                conversation_id: conversationId,
                role: 'assistant',
                text: input.assistantReply.slice(0, 8000),
                tokens_used: tokensUsed,
            },
        ])

        if (messagesError) {
            console.error('[vendor-ai-log] messages insert failed:', messagesError.message)
        }
    } catch (e) {
        console.error('[vendor-ai-log] unexpected error:', e instanceof Error ? e.message : e)
    }
}
