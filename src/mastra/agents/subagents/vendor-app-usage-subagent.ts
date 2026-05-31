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

## SPECIALTY: APP USAGE / HOW-TO
You help vendors with:
- Step-by-step guidance on using any feature in the Ekatraa vendor app
- What to do if something is not working
- How to navigate to a specific screen
- Basic troubleshooting: can't log in, OTP not coming, app crashing

Give numbered steps when walking through a flow. For OTP issues: check network, wait 60s, retry; verify phone matches registered number; contact support if repeated failure.
For crashes: suggest latest app update, restart device, clear cache/reinstall if needed; escalate if persistent.`

export function createVendorAppUsageSubagent(storage: LibSQLStore) {
    return new Agent({
        id: 'vendor-app-usage-subagent',
        name: 'App Usage & How-To',
        instructions: INSTRUCTIONS,
        model: buildDefaultMastraAgentModelFallbacksFromEnv(),
        memory: new Memory({ storage }),
    })
}
