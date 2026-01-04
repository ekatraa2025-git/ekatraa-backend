/**
 * Utility functions to extract location data from address strings
 */

/**
 * Extracts city name from an address string
 * Common patterns:
 * - "Street, City, State"
 * - "Street, City"
 * - "City, State, Country"
 * - "Address, City"
 */
export function extractCityFromAddress(address: string): string | null {
    if (!address || typeof address !== 'string') {
        return null
    }

    // Remove extra whitespace and normalize
    const normalized = address.trim().replace(/\s+/g, ' ')

    // Common Indian city patterns
    const indianCities = [
        'Mumbai', 'Delhi', 'Bangalore', 'Hyderabad', 'Chennai', 'Kolkata',
        'Pune', 'Ahmedabad', 'Jaipur', 'Surat', 'Lucknow', 'Kanpur',
        'Nagpur', 'Indore', 'Thane', 'Bhopal', 'Visakhapatnam', 'Patna',
        'Vadodara', 'Ghaziabad', 'Ludhiana', 'Agra', 'Nashik', 'Faridabad',
        'Meerut', 'Rajkot', 'Varanasi', 'Srinagar', 'Amritsar', 'Bhubaneswar',
        'Raipur', 'Allahabad', 'Coimbatore', 'Jabalpur', 'Gwalior', 'Vijayawada',
        'Madurai', 'Guwahati', 'Chandigarh', 'Solapur', 'Hubli', 'Bareilly',
        'Moradabad', 'Gurgaon', 'Aligarh', 'Jalandhar', 'Tiruchirappalli', 'Bhubaneshwar'
    ]

    // Try to find city by common patterns
    // Pattern 1: "..., City, State/Country"
    const commaPattern = /,\s*([^,]+?)(?:\s*,\s*(?:State|Country|India|IN))?$/i
    const commaMatch = normalized.match(commaPattern)
    if (commaMatch) {
        const potentialCity = commaMatch[1].trim()
        // Check if it's a known city or looks like a city name
        if (potentialCity.length > 2 && potentialCity.length < 50) {
            return potentialCity
        }
    }

    // Pattern 2: Look for known Indian cities in the address
    for (const city of indianCities) {
        const cityRegex = new RegExp(`\\b${city}\\b`, 'i')
        if (cityRegex.test(normalized)) {
            return city
        }
    }

    // Pattern 3: Extract last meaningful word/phrase before common suffixes
    const suffixPattern = /,\s*([^,]+?)(?:\s*-\s*\d+|,|\s*$)/i
    const suffixMatch = normalized.match(suffixPattern)
    if (suffixMatch) {
        const potentialCity = suffixMatch[1].trim()
        if (potentialCity.length > 2 && potentialCity.length < 50 && !/^\d+$/.test(potentialCity)) {
            return potentialCity
        }
    }

    // Pattern 4: If address contains "City:" or "City -"
    const explicitCityPattern = /(?:city|city\s*:)\s*([^,\n]+)/i
    const explicitMatch = normalized.match(explicitCityPattern)
    if (explicitMatch) {
        return explicitMatch[1].trim()
    }

    return null
}

/**
 * Extracts state from address (if available)
 */
export function extractStateFromAddress(address: string): string | null {
    if (!address || typeof address !== 'string') {
        return null
    }

    const normalized = address.trim()
    const statePattern = /,\s*([^,]+?)(?:\s*,\s*(?:Country|India|IN))?$/i
    const match = normalized.match(statePattern)
    
    if (match) {
        return match[1].trim()
    }

    return null
}

