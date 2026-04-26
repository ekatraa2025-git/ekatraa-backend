import './ensure-gemini-key'
import './ensure-anthropic-key'
import { Mastra } from '@mastra/core/mastra'
import { LibSQLStore } from '@mastra/libsql'
import { createEventPlanningAgent } from '@/mastra/agents/event-planning-agent'
import { createVendorAssistantAgent } from '@/mastra/agents/vendor-assistant-agent'
import { eventPlanningIntakeWorkflow } from '@/mastra/workflows/event-planning-intake'

/** Turso/libsql file URL for durable threads; default :memory: (OK for CI/build; set MASTRA_LIBSQL_URL in prod). */
const libsqlUrl = process.env.MASTRA_LIBSQL_URL?.trim() || ':memory:'

const storage = new LibSQLStore({
    id: 'ekatraa-mastra',
    url: libsqlUrl,
})

export const mastra = new Mastra({
    storage,
    agents: {
        eventPlanningAgent: createEventPlanningAgent(storage),
        vendorAssistantAgent: createVendorAssistantAgent(storage),
    },
    workflows: {
        eventPlanningIntake: eventPlanningIntakeWorkflow,
    },
})
