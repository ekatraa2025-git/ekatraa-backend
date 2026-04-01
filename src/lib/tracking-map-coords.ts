/**
 * Approximate coordinates for admin map visualization (India-focused).
 * Used only for dashboard display when precise GPS is not stored.
 */
import { extractCityFromAddress } from '@/utils/addressParser'

const CITY_COORDS: Record<string, [number, number]> = {
    mumbai: [19.076, 72.8777],
    delhi: [28.6139, 77.209],
    bengaluru: [12.9716, 77.5946],
    bangalore: [12.9716, 77.5946],
    hyderabad: [17.385, 78.4867],
    chennai: [13.0827, 80.2707],
    kolkata: [22.5726, 88.3639],
    pune: [18.5204, 73.8567],
    ahmedabad: [23.0225, 72.5714],
    jaipur: [26.9124, 75.7873],
    surat: [21.1702, 72.8311],
    lucknow: [26.8467, 80.9462],
    bhubaneswar: [20.2961, 85.8245],
    bhubaneshwar: [20.2961, 85.8245],
    cuttack: [20.4625, 85.8829],
    puri: [19.8135, 85.8312],
    indore: [22.7196, 75.8577],
    nagpur: [21.1458, 79.0882],
    coimbatore: [11.0168, 76.9558],
    kochi: [9.9312, 76.2673],
    visakhapatnam: [17.6868, 83.2185],
    patna: [25.5941, 85.1376],
    vadodara: [22.3072, 73.1812],
    ghaziabad: [28.6692, 77.4538],
    ludhiana: [30.901, 75.8573],
    gurgaon: [28.4595, 77.0266],
    gurugram: [28.4595, 77.0266],
    noida: [28.5355, 77.391],
    faridabad: [28.4089, 77.3178],
    chandigarh: [30.7333, 76.7794],
    guwahati: [26.1445, 91.7362],
    thiruvananthapuram: [8.5241, 76.9366],
    madurai: [9.9252, 78.1198],
    vijayawada: [16.5062, 80.648],
    raipur: [21.2514, 81.6296],
    ranchi: [23.3441, 85.3096],
    mysore: [12.2958, 76.6394],
    mysuru: [12.2958, 76.6394],
    mangalore: [12.9141, 74.856],
    udupi: [13.3409, 74.7421],
    belgaum: [15.8497, 74.4977],
    hubli: [15.3647, 75.124],
    goa: [15.2993, 74.124],
    panaji: [15.4909, 73.8278],
}

/** Stable small offset so markers never sit exactly on top of each other. */
export function jitterLatLng(seed: string, lat: number, lng: number): { lat: number; lng: number } {
    let h = 0
    for (let i = 0; i < seed.length; i++) {
        h = (h * 31 + seed.charCodeAt(i)) | 0
    }
    const dx = ((h % 2000) - 1000) / 80000
    const dy = ((((h >> 8) % 2000) - 1000) / 80000) * 1.2
    return { lat: lat + dx, lng: lng + dy }
}

function normalizeCityKey(raw: string): string {
    return raw
        .toLowerCase()
        .trim()
        .replace(/\s+/g, ' ')
        .replace(/[^a-z0-9\s]/g, '')
}

export function resolveLatLngFromLocation(
    city: string | null | undefined,
    addressOrPreference: string | null | undefined,
    seed: string
): { lat: number; lng: number } {
    const fromExtract = extractCityFromAddress(addressOrPreference || '') || ''
    const key = normalizeCityKey(city || fromExtract || '')
    if (key && CITY_COORDS[key]) {
        const [la, ln] = CITY_COORDS[key]
        return jitterLatLng(seed, la, ln)
    }
    for (const [k, [la, ln]] of Object.entries(CITY_COORDS)) {
        if (key && (key.includes(k) || k.includes(key))) {
            return jitterLatLng(seed, la, ln)
        }
    }
    // India centroid fallback
    return jitterLatLng(seed, 20.5937, 78.9629)
}

export function haversineKm(a: { lat: number; lng: number }, b: { lat: number; lng: number }): number {
    const R = 6371
    const dLat = ((b.lat - a.lat) * Math.PI) / 180
    const dLng = ((b.lng - a.lng) * Math.PI) / 180
    const lat1 = (a.lat * Math.PI) / 180
    const lat2 = (b.lat * Math.PI) / 180
    const x =
        Math.sin(dLat / 2) * Math.sin(dLat / 2) +
        Math.sin(dLng / 2) * Math.sin(dLng / 2) * Math.cos(lat1) * Math.cos(lat2)
    const c = 2 * Math.atan2(Math.sqrt(x), Math.sqrt(1 - x))
    return R * c
}
