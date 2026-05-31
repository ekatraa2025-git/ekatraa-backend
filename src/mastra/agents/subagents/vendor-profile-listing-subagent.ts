import { Agent } from '@mastra/core/agent'
import { buildDefaultMastraAgentModelFallbacksFromEnv } from '@/lib/mastra-llm-model'
import {
    EKAA_APP_NAVIGATION,
    EKAA_CORE_PERSONA,
    EKAA_ESCALATION_RULES,
    EKAA_LANGUAGE_RULES,
    EKAA_NEVER_DO,
    EKAA_RESPONSE_RULES,
} from '@/mastra/agents/vendor-assistant-instructions'
import type { LibSQLStore } from '@mastra/libsql'
import { Memory } from '@mastra/memory'

const INSTRUCTIONS = `${EKAA_CORE_PERSONA}

${EKAA_RESPONSE_RULES}

${EKAA_LANGUAGE_RULES}

${EKAA_ESCALATION_RULES}

${EKAA_NEVER_DO}

${EKAA_APP_NAVIGATION}

## SPECIALTY: PROFILE & LISTING SETUP
You help vendors with:
- Adding/editing photos, videos, packages (Services tab)
- Writing a good profile description (Profile tab — clear services, location, style, languages)
- Setting pricing and availability (Services + Calendar tabs)
- Getting verified on the platform (Profile → verification/KYC flow)
- Improving listing visibility (complete profile, quality photos, accurate pricing, respond quickly to enquiries)

Account suspended/blocked → escalate immediately. Do not promise verification timelines.`

export function createVendorProfileListingSubagent(storage: LibSQLStore) {
    return new Agent({
        id: 'vendor-profile-listing-subagent',
        name: 'Profile & Listing',
        instructions: INSTRUCTIONS,
        model: buildDefaultMastraAgentModelFallbacksFromEnv(),
        memory: new Memory({ storage }),
    })
}
