import { supabase } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'

const OCCASIONS = [
    { id: 'wedding', name: 'Wedding', icon: '💒', display_order: 1 },
    { id: 'janeyu-thread', name: 'Janeyu/Thread', icon: '🪔', display_order: 2 },
    { id: 'birthday-anniversary', name: 'Birthday/Anniversary', icon: '🎂', display_order: 3 },
    { id: 'puja', name: 'Any Kind of Puja', icon: '🙏', display_order: 4 },
    { id: 'social-gathering', name: 'Any Social Gathering', icon: '🤝', display_order: 5 },
    { id: 'corporate', name: 'Corporate', icon: '🏢', display_order: 6 },
    { id: 'funeral-anesthi', name: 'Funeral/Anesthi', icon: '🕯️', display_order: 7 },
]

const CATEGORIES = [
    { id: 'venue', name: 'Venue', display_order: 1 },
    { id: 'decor', name: 'Décor', display_order: 2 },
    { id: 'menu', name: 'Menu', display_order: 3 },
    { id: 'venue-menu', name: 'Venue + Menu', display_order: 4 },
    { id: 'menu-decor', name: 'Menu + Décor', display_order: 5 },
    { id: 'venue-menu-decor', name: 'Venue + Menu + Décor', display_order: 6 },
    { id: 'photo-video', name: 'Photo/Video', display_order: 7 },
    { id: 'salon-mehndi', name: 'Salon and Mehndi', display_order: 8 },
    { id: 'nail-salon', name: 'Nail Salon', display_order: 9 },
    { id: 'dj-sound-band', name: 'DJ Sound/Band Party', display_order: 10 },
    { id: 'cars', name: 'Cars', display_order: 11 },
    { id: 'melody-musicals', name: 'Melody/Musicals', display_order: 12 },
    { id: 'fire-crackers', name: 'Fire Crackers', display_order: 13 },
    { id: 'florist-flower-decor', name: 'Florist - Flower Décor', display_order: 14 },
    { id: 'event-management', name: 'Event Management Company', display_order: 15 },
    { id: 'priest-pandit', name: 'Priest/Pandit', display_order: 16 },
    { id: 'barber-barika', name: 'Barber/Barika', display_order: 17 },
    { id: 'female-barber', name: 'Female Barber/Barikani', display_order: 18 },
    { id: 'ethnic-band', name: 'Ethnic Band/Baja wala', display_order: 19 },
    { id: 'shankhua', name: 'Shankhua', display_order: 20 },
    { id: 'puja-samagri', name: 'Puja Samagri', display_order: 21 },
    { id: 'bhara', name: 'Bhara', display_order: 22 },
    { id: 'mahaprasad', name: 'Mahaprasad Booking', display_order: 23 },
    { id: 'security', name: 'Security Arrangement', display_order: 24 },
    { id: 'kids-birthday-venue', name: "Kid's Birthday Venue", display_order: 25 },
    { id: 'kids-venue-menu', name: "Kid's Birthday Venue + Menu", display_order: 26 },
    { id: 'kids-venue-menu-decor', name: "Kid's Birthday Venue + Menu + Décor", display_order: 27 },
    { id: 'bakery', name: 'Bakery', display_order: 28 },
    { id: 'return-gift', name: 'Return Gift', display_order: 29 },
    { id: 'magician', name: 'Magician', display_order: 30 },
    { id: 'kids-games', name: 'Kids Games', display_order: 31 },
]

// Map occasion → category IDs based on spreadsheet
const OCCASION_CATEGORY_MAP: Record<string, string[]> = {
    'wedding': [
        'venue', 'decor', 'menu', 'venue-menu', 'menu-decor', 'venue-menu-decor',
        'photo-video', 'salon-mehndi', 'nail-salon', 'dj-sound-band', 'cars',
        'melody-musicals', 'fire-crackers', 'florist-flower-decor', 'event-management',
        'priest-pandit', 'barber-barika', 'female-barber', 'ethnic-band', 'shankhua',
        'puja-samagri', 'bhara', 'mahaprasad',
    ],
    'janeyu-thread': [
        'venue', 'decor', 'menu', 'venue-menu', 'menu-decor', 'venue-menu-decor',
        'photo-video', 'salon-mehndi', 'nail-salon', 'dj-sound-band', 'cars',
        'melody-musicals', 'fire-crackers', 'florist-flower-decor', 'security',
        'event-management', 'priest-pandit', 'barber-barika', 'female-barber',
        'ethnic-band', 'shankhua', 'puja-samagri', 'bhara', 'mahaprasad',
    ],
    'birthday-anniversary': [
        'venue', 'kids-birthday-venue', 'kids-venue-menu', 'kids-venue-menu-decor',
        'menu', 'decor', 'menu-decor', 'venue-menu', 'venue-menu-decor',
        'bakery', 'return-gift', 'magician', 'kids-games', 'florist-flower-decor',
        'photo-video', 'salon-mehndi', 'mahaprasad',
    ],
    'puja': [
        'venue', 'decor', 'menu', 'venue-menu', 'menu-decor', 'venue-menu-decor',
        'florist-flower-decor', 'photo-video', 'priest-pandit', 'shankhua',
        'puja-samagri', 'mahaprasad',
    ],
    'social-gathering': [
        'venue', 'decor', 'menu', 'venue-menu', 'menu-decor', 'venue-menu-decor',
        'florist-flower-decor', 'photo-video', 'salon-mehndi', 'mahaprasad',
        'barber-barika', 'female-barber',
    ],
    'corporate': [
        'venue', 'decor', 'menu', 'venue-menu', 'menu-decor', 'venue-menu-decor',
        'florist-flower-decor', 'photo-video', 'mahaprasad', 'priest-pandit',
    ],
    'funeral-anesthi': [
        'venue', 'decor', 'menu', 'venue-menu', 'menu-decor', 'venue-menu-decor',
        'florist-flower-decor', 'photo-video', 'mahaprasad',
    ],
}

// Venue services with tier pricing
const VENUE_SERVICES = [
    {
        id: 'only-banquet-hall',
        name: 'Only Banquet Hall',
        category_id: 'venue',
        description: 'Premium banquet hall for your event with all basic amenities included.',
        price_classic_value: 30000,
        price_signature: 50000,
        price_prestige: 100000,
        price_royal: 200000,
        price_imperial: 300000,
        display_order: 1,
    },
    {
        id: 'only-lawn',
        name: 'Only Lawn',
        category_id: 'venue',
        description: 'Spacious outdoor lawn perfect for open-air celebrations.',
        price_classic_value: 30000,
        price_signature: 50000,
        price_prestige: 100000,
        price_royal: 200000,
        price_imperial: 300000,
        display_order: 2,
    },
    {
        id: 'banquet-hall-with-lawn',
        name: 'Banquet Hall With Lawn',
        category_id: 'venue',
        description: 'Complete venue package with both indoor banquet hall and outdoor lawn.',
        price_classic_value: 50000,
        price_signature: 100000,
        price_prestige: 200000,
        price_royal: 350000,
        price_imperial: 500000,
        display_order: 3,
    },
    {
        id: 'room-ac-single',
        name: 'Rooms (AC) / Day / Single Occupancy',
        category_id: 'venue',
        description: 'Air-conditioned single occupancy rooms for event guests.',
        price_classic_value: 1000,
        price_signature: 1500,
        price_prestige: 2500,
        price_royal: 4000,
        price_imperial: 8000,
        display_order: 4,
    },
    {
        id: 'room-ac-double',
        name: 'Rooms (AC) / Day / Double Occupancy',
        category_id: 'venue',
        description: 'Air-conditioned double occupancy rooms for event guests.',
        price_classic_value: 1200,
        price_signature: 1800,
        price_prestige: 3000,
        price_royal: 5000,
        price_imperial: 10000,
        display_order: 5,
    },
]

export async function POST() {
    const results: string[] = []

    try {
        // 1. Seed occasions
        const { error: occErr } = await supabase
            .from('occasions')
            .upsert(OCCASIONS.map(o => ({ ...o, is_active: true })), { onConflict: 'id' })
        if (occErr) results.push(`Occasions error: ${occErr.message}`)
        else results.push(`Occasions: ${OCCASIONS.length} upserted`)

        // 2. Seed categories
        const { error: catErr } = await supabase
            .from('categories')
            .upsert(CATEGORIES.map(c => ({ ...c, is_active: true })), { onConflict: 'id' })
        if (catErr) results.push(`Categories error: ${catErr.message}`)
        else results.push(`Categories: ${CATEGORIES.length} upserted`)

        // 3. Seed occasion_categories links
        const links: { occasion_id: string; category_id: string; display_order: number }[] = []
        for (const [occasionId, categoryIds] of Object.entries(OCCASION_CATEGORY_MAP)) {
            categoryIds.forEach((catId, idx) => {
                links.push({ occasion_id: occasionId, category_id: catId, display_order: idx + 1 })
            })
        }
        // Delete existing links first to avoid duplicates
        await supabase.from('occasion_categories').delete().neq('occasion_id', '__none__')
        const { error: linkErr } = await supabase
            .from('occasion_categories')
            .insert(links)
        if (linkErr) results.push(`Occasion-Category links error: ${linkErr.message}`)
        else results.push(`Occasion-Category links: ${links.length} inserted`)

        // 4. Seed venue services (offerable_services)
        const { error: svcErr } = await supabase
            .from('offerable_services')
            .upsert(
                VENUE_SERVICES.map(s => ({ ...s, is_active: true })),
                { onConflict: 'id' }
            )
        if (svcErr) results.push(`Services error: ${svcErr.message}`)
        else results.push(`Services: ${VENUE_SERVICES.length} upserted`)

        return NextResponse.json({ success: true, results })
    } catch (e) {
        return NextResponse.json({ error: (e as Error).message, results }, { status: 500 })
    }
}
