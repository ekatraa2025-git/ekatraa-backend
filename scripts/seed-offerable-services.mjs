#!/usr/bin/env node
/**
 * Seed script for offerable services (and occasions/categories).
 * Ensures migration 010 (price_basic) is applied, then calls POST /api/admin/seed.
 *
 * Usage:
 *   1. Apply migration: run migrations/010_add_price_basic_offerable_services.sql in Supabase SQL Editor.
 *   2. Start the backend: npm run dev (or have it running elsewhere).
 *   3. Run: npm run seed
 *
 * Or call the API directly: curl -X POST http://localhost:3000/api/admin/seed
 */

const BASE_URL = process.env.BASE_URL || process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'

async function main() {
    console.log('Calling seed API at', BASE_URL + '/api/admin/seed')
    const res = await fetch(BASE_URL + '/api/admin/seed', { method: 'POST' })
    const data = await res.json().catch(() => ({}))
    if (!res.ok) {
        console.error('Seed failed:', res.status, data)
        process.exit(1)
    }
    console.log('Seed result:', data.results ? data.results.join('\n') : data)
}

main().catch((e) => {
    console.error(e)
    process.exit(1)
})
