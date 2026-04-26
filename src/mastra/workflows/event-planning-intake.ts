import { createStep, createWorkflow } from '@mastra/core/workflows'
import { z } from 'zod'

/**
 * Lightweight intake workflow: surfaces human-gating signal when the client
 * supplied both occasion and budget (cart mutations stay behind explicit UI confirm).
 */
const intakeStep = createStep({
    id: 'intake-normalize',
    inputSchema: z.object({
        text: z.string(),
        occasion_id: z.string().optional(),
        budget_inr: z.number().optional(),
    }),
    outputSchema: z.object({
        awaiting_approval: z.boolean(),
        summary: z.string(),
    }),
    execute: async ({ inputData }) => {
        const awaiting =
            Boolean(inputData.occasion_id?.trim()) &&
            typeof inputData.budget_inr === 'number' &&
            inputData.budget_inr > 0
        return {
            awaiting_approval: awaiting,
            summary: awaiting
                ? 'Occasion and budget captured — recommend confirming cart changes in the app before applying.'
                : `User message: ${inputData.text.slice(0, 800)}`,
        }
    },
})

export const eventPlanningIntakeWorkflow = createWorkflow({
    id: 'event-planning-intake',
    description: 'Normalize planning intake and approval gating hints.',
    inputSchema: z.object({
        text: z.string(),
        occasion_id: z.string().optional(),
        budget_inr: z.number().optional(),
    }),
    outputSchema: z.object({
        awaiting_approval: z.boolean(),
        summary: z.string(),
    }),
})
    .then(intakeStep)
    .commit()
