import { supabase } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'
import { createHash } from 'crypto'

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

// Venue services with tier pricing (Basic + Classic → Imperial)
const VENUE_SERVICES = [
    {
        id: 'only-banquet-hall',
        name: 'Only Banquet Hall',
        category_id: 'venue',
        description: 'Premium banquet hall for your event with all basic amenities included.',
        price_basic: 30000,
        price_classic_value: 50000,
        price_signature: 100000,
        price_prestige: 200000,
        price_royal: 300000,
        price_imperial: null,
        display_order: 1,
    },
    {
        id: 'only-lawn',
        name: 'Only Lawn',
        category_id: 'venue',
        description: 'Spacious outdoor lawn perfect for open-air celebrations.',
        price_basic: 30000,
        price_classic_value: 50000,
        price_signature: 100000,
        price_prestige: 200000,
        price_royal: 300000,
        price_imperial: null,
        display_order: 2,
    },
    {
        id: 'banquet-hall-with-lawn',
        name: 'Banquet Hall With Lawn',
        category_id: 'venue',
        description: 'Complete venue package with both indoor banquet hall and outdoor lawn.',
        price_basic: 50000,
        price_classic_value: 100000,
        price_signature: 200000,
        price_prestige: 350000,
        price_royal: 500000,
        price_imperial: null,
        display_order: 3,
    },
    {
        id: 'room-ac-single',
        name: 'Rooms (AC) / Day / Single Occupancy',
        category_id: 'venue',
        description: 'Air-conditioned single occupancy rooms for event guests.',
        price_basic: 1000,
        price_classic_value: 1500,
        price_signature: 2500,
        price_prestige: 4000,
        price_royal: 8000,
        price_imperial: null,
        display_order: 4,
    },
    {
        id: 'room-ac-double',
        name: 'Rooms (AC) / Day / Double Occupancy',
        category_id: 'venue',
        description: 'Air-conditioned double occupancy rooms for event guests.',
        price_basic: 1200,
        price_classic_value: 1800,
        price_signature: 3000,
        price_prestige: 5000,
        price_royal: 10000,
        price_imperial: null,
        display_order: 5,
    },
]

// All other offerable services from pricing spreadsheet (Decorator, Pandit, Caterer, etc.)
const OTHER_OFFERABLE_SERVICES = [
    // Decorator (Décor)
    { id: 'decor-marriage-janeyu', name: 'Marriage/Janeyu/Thread', category_id: 'decor', description: 'Full décor for marriage, janeyu or thread ceremony.', price_basic: 30000, price_classic_value: 100000, price_signature: 200000, price_prestige: 300000, price_royal: 500000, price_imperial: null, display_order: 1 },
    { id: 'decor-mangalkrutya-haldi', name: 'Mangalkrutya/Haldi/Sangeet', category_id: 'decor', description: 'Décor for Mangalkrutya, Haldi or Sangeet.', price_basic: 20000, price_classic_value: 50000, price_signature: 100000, price_prestige: 200000, price_royal: 300000, price_imperial: null, display_order: 2 },
    { id: 'decor-birthday-social-funeral', name: 'Birthday/Social gathering/Funeral', category_id: 'decor', description: 'Décor for birthday, social gathering or funeral.', price_basic: 20000, price_classic_value: 50000, price_signature: 100000, price_prestige: 200000, price_royal: 300000, price_imperial: null, display_order: 3 },
    { id: 'decor-any-gathering', name: 'Any Gathering', category_id: 'decor', description: 'Décor for any gathering.', price_basic: 2000, price_classic_value: 3000, price_signature: 7000, price_prestige: 10000, price_royal: 15000, price_imperial: null, display_order: 4 },
    // Pandit (Priest/Pandit) — single tier (Basic only)
    { id: 'pandit-brides-marriage', name: "Bride's Marriage", category_id: 'priest-pandit', description: 'Pandit for bride\'s marriage ceremony.', price_basic: 7000, price_classic_value: null, price_signature: null, price_prestige: null, price_royal: null, price_imperial: null, display_order: 1 },
    { id: 'pandit-grooms-marriage', name: "Groom's Marriage", category_id: 'priest-pandit', description: 'Pandit for groom\'s marriage ceremony.', price_basic: 7000, price_classic_value: null, price_signature: null, price_prestige: null, price_royal: null, price_imperial: null, display_order: 2 },
    { id: 'pandit-brides-mangalkrutya', name: "Bride's Mangalkrutya", category_id: 'priest-pandit', description: 'Pandit for bride\'s Mangalkrutya.', price_basic: 3000, price_classic_value: null, price_signature: null, price_prestige: null, price_royal: null, price_imperial: null, display_order: 3 },
    { id: 'pandit-grooms-mangalkrutya', name: "Groom's Mangalkrutya", category_id: 'priest-pandit', description: 'Pandit for groom\'s Mangalkrutya.', price_basic: 3000, price_classic_value: null, price_signature: null, price_prestige: null, price_royal: null, price_imperial: null, display_order: 4 },
    { id: 'pandit-janeyu', name: 'Janeyu', category_id: 'priest-pandit', description: 'Pandit for Janeyu ceremony.', price_basic: 7000, price_classic_value: null, price_signature: null, price_prestige: null, price_royal: null, price_imperial: null, display_order: 5 },
    { id: 'pandit-mangalkrutya', name: 'Mangalkrutya', category_id: 'priest-pandit', description: 'Pandit for Mangalkrutya.', price_basic: 3000, price_classic_value: null, price_signature: null, price_prestige: null, price_royal: null, price_imperial: null, display_order: 6 },
    { id: 'pandit-other-big-puja', name: 'Other Big Puja (More Than 2 lt Ghee Involved)', category_id: 'priest-pandit', description: 'Pandit for other big puja with more than 2L ghee.', price_basic: 5000, price_classic_value: null, price_signature: null, price_prestige: null, price_royal: null, price_imperial: null, display_order: 7 },
    { id: 'pandit-other-small-puja', name: 'Other Small Puja (Less Than 2 lt Ghee Involved)', category_id: 'priest-pandit', description: 'Pandit for other small puja with less than 2L ghee.', price_basic: 3000, price_classic_value: null, price_signature: null, price_prestige: null, price_royal: null, price_imperial: null, display_order: 8 },
    { id: 'pandit-chandi-path', name: 'Chandi Path/Puja', category_id: 'priest-pandit', description: 'Chandi Path or Chandi Puja.', price_basic: 5000, price_classic_value: null, price_signature: null, price_prestige: null, price_royal: null, price_imperial: null, display_order: 9 },
    { id: 'pandit-yagya-more-2l', name: 'Yagya with more than 2 liters of Ghee', category_id: 'priest-pandit', description: 'Yagya with more than 2L ghee.', price_basic: 5000, price_classic_value: null, price_signature: null, price_prestige: null, price_royal: null, price_imperial: null, display_order: 10 },
    { id: 'pandit-yagya-less-2l', name: 'Yagya with less than 2 liters of Ghee', category_id: 'priest-pandit', description: 'Yagya with less than 2L ghee.', price_basic: 3000, price_classic_value: null, price_signature: null, price_prestige: null, price_royal: null, price_imperial: null, display_order: 11 },
    { id: 'pandit-antesti-kriya', name: 'Antesti Kriya/Dasa Tutha Kama', category_id: 'priest-pandit', description: 'Antesti Kriya / Dasa Tutha Kama.', price_basic: 7000, price_classic_value: null, price_signature: null, price_prestige: null, price_royal: null, price_imperial: null, display_order: 12 },
    { id: 'pandit-shradh', name: 'Shradh', category_id: 'priest-pandit', description: 'Shradh ceremony.', price_basic: 5000, price_classic_value: null, price_signature: null, price_prestige: null, price_royal: null, price_imperial: null, display_order: 13 },
    // Barika, Barikani, Shankhua, Ethnic Band (per day)
    { id: 'barika-per-day', name: 'Barika (Per day)', category_id: 'barber-barika', description: 'Barber/Barika services per day.', price_basic: 3000, price_classic_value: null, price_signature: null, price_prestige: null, price_royal: null, price_imperial: null, display_order: 1 },
    { id: 'barikani-per-day', name: 'Barikani (Per day)', category_id: 'female-barber', description: 'Female Barber/Barikani per day.', price_basic: 1500, price_classic_value: null, price_signature: null, price_prestige: null, price_royal: null, price_imperial: null, display_order: 1 },
    { id: 'shankhua-per-day', name: 'Shankhua (Per day)', category_id: 'shankhua', description: 'Shankhua per day.', price_basic: 1500, price_classic_value: null, price_signature: null, price_prestige: null, price_royal: null, price_imperial: null, display_order: 1 },
    { id: 'ethnic-band-per-day', name: 'Ethnic Band (Per day)', category_id: 'ethnic-band', description: 'Ethnic Band per day.', price_basic: 5000, price_classic_value: null, price_signature: null, price_prestige: null, price_royal: null, price_imperial: null, display_order: 1 },
    // Caterer (Menu) — Veg and Non-Veg tiers
    { id: 'caterer-veg-1', name: 'Veg (25 items)', category_id: 'menu', description: 'Veg menu — Basic 25 items.', price_basic: 499, price_classic_value: 599, price_signature: 699, price_prestige: 999, price_royal: 1299, price_imperial: null, display_order: 1 },
    { id: 'caterer-veg-2', name: 'Veg (30 items)', category_id: 'menu', description: 'Veg menu — Classic Value 30 items.', price_basic: 479, price_classic_value: 559, price_signature: 659, price_prestige: 959, price_royal: 1259, price_imperial: null, display_order: 2 },
    { id: 'caterer-veg-3', name: 'Veg (35 items)', category_id: 'menu', description: 'Veg menu — Signature 35 items.', price_basic: 449, price_classic_value: 529, price_signature: 629, price_prestige: 929, price_royal: 1229, price_imperial: null, display_order: 3 },
    { id: 'caterer-nonveg-cf-1', name: 'Non-Veg with Chicken + Fish (25 items)', category_id: 'menu', description: 'Non-Veg with Chicken + Fish.', price_basic: 599, price_classic_value: 699, price_signature: 799, price_prestige: 1099, price_royal: 1499, price_imperial: null, display_order: 4 },
    { id: 'caterer-nonveg-cf-2', name: 'Non-Veg with Chicken + Fish (30 items)', category_id: 'menu', description: 'Non-Veg with Chicken + Fish — 30 items.', price_basic: 579, price_classic_value: 659, price_signature: 759, price_prestige: 1059, price_royal: 1459, price_imperial: null, display_order: 5 },
    { id: 'caterer-nonveg-cf-3', name: 'Non-Veg with Chicken + Fish (35 items)', category_id: 'menu', description: 'Non-Veg with Chicken + Fish — 35 items.', price_basic: 549, price_classic_value: 629, price_signature: 729, price_prestige: 1029, price_royal: 1429, price_imperial: null, display_order: 6 },
    { id: 'caterer-nonveg-prawn-1', name: 'Non-Veg with Chicken + Fish + Prawn (25 items)', category_id: 'menu', description: 'Non-Veg with Chicken + Fish + Prawn.', price_basic: 799, price_classic_value: 899, price_signature: 999, price_prestige: 1199, price_royal: 1599, price_imperial: null, display_order: 7 },
    { id: 'caterer-nonveg-prawn-2', name: 'Non-Veg with Chicken + Fish + Prawn (30 items)', category_id: 'menu', description: 'Non-Veg with Chicken + Fish + Prawn — 30 items.', price_basic: 779, price_classic_value: 859, price_signature: 959, price_prestige: 1159, price_royal: 1559, price_imperial: null, display_order: 8 },
    { id: 'caterer-nonveg-prawn-3', name: 'Non-Veg with Chicken + Fish + Prawn (35 items)', category_id: 'menu', description: 'Non-Veg with Chicken + Fish + Prawn — 35 items.', price_basic: 759, price_classic_value: 829, price_signature: 929, price_prestige: 1129, price_royal: 1529, price_imperial: null, display_order: 9 },
    { id: 'caterer-nonveg-mutton-1', name: 'Non-Veg with Chicken + Fish + Prawn + Mutton (25 items)', category_id: 'menu', description: 'Non-Veg with Chicken + Fish + Prawn + Mutton.', price_basic: 999, price_classic_value: 1099, price_signature: 1199, price_prestige: 1299, price_royal: 1799, price_imperial: null, display_order: 10 },
    { id: 'caterer-nonveg-mutton-2', name: 'Non-Veg with Chicken + Fish + Prawn + Mutton (30 items)', category_id: 'menu', description: 'Non-Veg with Chicken + Fish + Prawn + Mutton — 30 items.', price_basic: 979, price_classic_value: 1059, price_signature: 1159, price_prestige: 1259, price_royal: 1759, price_imperial: null, display_order: 11 },
    { id: 'caterer-nonveg-mutton-3', name: 'Non-Veg with Chicken + Fish + Prawn + Mutton (35 items)', category_id: 'menu', description: 'Non-Veg with Chicken + Fish + Prawn + Mutton — 35 items.', price_basic: 949, price_classic_value: 1029, price_signature: 1129, price_prestige: 1229, price_royal: 1729, price_imperial: null, display_order: 12 },
    // Photo/Video
    { id: 'photo-video-per-day', name: 'Photo/Video (Per Day)', category_id: 'photo-video', description: 'Photo and video coverage per day.', price_basic: 15000, price_classic_value: 25000, price_signature: 35000, price_prestige: 60000, price_royal: 90000, price_imperial: null, display_order: 1 },
    { id: 'photo-video-pre-post-wedding', name: 'Pre/Post Wedding (Per Day)', category_id: 'photo-video', description: 'Pre/Post wedding photo and video per day.', price_basic: 15000, price_classic_value: 25000, price_signature: 35000, price_prestige: 60000, price_royal: 90000, price_imperial: null, display_order: 2 },
    // Make Up Artist (Salon and Mehndi)
    { id: 'makeup-bridal', name: 'Bridal Make Up', category_id: 'salon-mehndi', description: 'Bridal make-up package.', price_basic: 7000, price_classic_value: 12000, price_signature: 15000, price_prestige: 25000, price_royal: 40000, price_imperial: null, display_order: 1 },
    { id: 'makeup-any-events', name: 'Any Events (Make Up)', category_id: 'salon-mehndi', description: 'Make up for any events.', price_basic: 10000, price_classic_value: 20000, price_signature: 30000, price_prestige: 40000, price_royal: 50000, price_imperial: null, display_order: 2 },
    { id: 'mehndi-any-event', name: 'Mehndi (Any event)', category_id: 'salon-mehndi', description: 'Mehndi for any event.', price_basic: 3000, price_classic_value: 5000, price_signature: 10000, price_prestige: 15000, price_royal: 20000, price_imperial: null, display_order: 3 },
    { id: 'nail-salon-any-event', name: 'Nail Salon (Any event)', category_id: 'nail-salon', description: 'Nail salon for any event.', price_basic: 3000, price_classic_value: 5000, price_signature: 10000, price_prestige: 15000, price_royal: 20000, price_imperial: null, display_order: 1 },
    { id: 'event-mgmt-any-event', name: 'Event Management (Any event)', category_id: 'event-management', description: 'Full event management for any event.', price_basic: 20000, price_classic_value: 50000, price_signature: 100000, price_prestige: 150000, price_royal: 200000, price_imperial: null, display_order: 1 },
    // DJ and Sound
    { id: 'dj-van', name: 'DJ Van', category_id: 'dj-sound-band', description: 'DJ Van package.', price_basic: 50000, price_classic_value: 70000, price_signature: 90000, price_prestige: 110000, price_royal: 130000, price_imperial: null, display_order: 1 },
    { id: 'band-party', name: 'Band Party', category_id: 'dj-sound-band', description: 'Band party package.', price_basic: 40000, price_classic_value: 65000, price_signature: 75000, price_prestige: 100000, price_royal: 120000, price_imperial: null, display_order: 2 },
    { id: 'box-sound-system', name: 'Box and Sound System', category_id: 'dj-sound-band', description: 'Box and sound system.', price_basic: 10000, price_classic_value: 20000, price_signature: 30000, price_prestige: 40000, price_royal: 50000, price_imperial: null, display_order: 3 },
    { id: 'sound-band', name: 'Sound/Band', category_id: 'dj-sound-band', description: 'Sound or band package.', price_basic: 10000, price_classic_value: 20000, price_signature: 30000, price_prestige: 40000, price_royal: 50000, price_imperial: null, display_order: 4 },
    // Kids Game, Melody, Bhajan
    { id: 'kids-games', name: 'Kids Games', category_id: 'kids-games', description: 'Kids games and entertainment.', price_basic: 20000, price_classic_value: 30000, price_signature: 40000, price_prestige: 50000, price_royal: 60000, price_imperial: null, display_order: 1 },
    { id: 'melody-event', name: 'Melody Event', category_id: 'melody-musicals', description: 'Melody event package.', price_basic: 20000, price_classic_value: 30000, price_signature: 40000, price_prestige: 50000, price_royal: 70000, price_imperial: null, display_order: 1 },
    { id: 'bhajan', name: 'Bhajan', category_id: 'melody-musicals', description: 'Bhajan programme.', price_basic: 10000, price_classic_value: 20000, price_signature: 30000, price_prestige: 40000, price_royal: 50000, price_imperial: null, display_order: 2 },
    // Florist
    { id: 'florist-marriage-janeyu', name: 'Marriage/Janeyu/Thread', category_id: 'florist-flower-decor', description: 'Floral décor for marriage, janeyu or thread.', price_basic: 20000, price_classic_value: 50000, price_signature: 100000, price_prestige: 200000, price_royal: 300000, price_imperial: null, display_order: 1 },
    { id: 'florist-mangalkrutya-haldi', name: 'Mangalkrutya/Haldi/Sangeet', category_id: 'florist-flower-decor', description: 'Floral décor for Mangalkrutya, Haldi or Sangeet.', price_basic: 20000, price_classic_value: 50000, price_signature: 100000, price_prestige: 200000, price_royal: 300000, price_imperial: null, display_order: 2 },
    { id: 'florist-suhagraat', name: 'Suhagraat', category_id: 'florist-flower-decor', description: 'Suhagraat floral décor.', price_basic: 10000, price_classic_value: 20000, price_signature: 30000, price_prestige: 50000, price_royal: 100000, price_imperial: null, display_order: 3 },
    { id: 'florist-other-occasions', name: 'Other Occasions', category_id: 'florist-flower-decor', description: 'Floral décor for other occasions.', price_basic: 2000, price_classic_value: 5000, price_signature: 10000, price_prestige: 20000, price_royal: 30000, price_imperial: null, display_order: 4 },
]

function toSeedUuid(seedKey: string): string {
    const hex = createHash('sha1').update(seedKey).digest('hex').slice(0, 32)
    const chars = hex.split('')
    chars[12] = '5' // UUID version 5 style
    chars[16] = ((parseInt(chars[16], 16) & 0x3) | 0x8).toString(16) // RFC variant
    return `${chars.slice(0, 8).join('')}-${chars.slice(8, 12).join('')}-${chars.slice(12, 16).join('')}-${chars.slice(16, 20).join('')}-${chars.slice(20, 32).join('')}`
}

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

        // 4. Seed offerable_services (venue + all other services from pricing spreadsheet)
        const ALL_OFFERABLE_SERVICES = [...VENUE_SERVICES, ...OTHER_OFFERABLE_SERVICES]
        const withMinMax = ALL_OFFERABLE_SERVICES.map((s) => {
            const prices = [s.price_basic, s.price_classic_value, s.price_signature, s.price_prestige, s.price_royal, s.price_imperial].filter((p): p is number => typeof p === 'number' && !Number.isNaN(p))
            const price_min = prices.length > 0 ? Math.min(...prices) : null
            const price_max = prices.length > 0 ? Math.max(...prices) : null
            return {
                ...s,
                id: toSeedUuid(`offerable-services:${s.id}`),
                price_min,
                price_max,
                is_active: true,
            }
        })
        const { error: svcErr } = await supabase
            .from('offerable_services')
            .upsert(withMinMax, { onConflict: 'id' })
        if (svcErr) results.push(`Services error: ${svcErr.message}`)
        else results.push(`Services: ${ALL_OFFERABLE_SERVICES.length} upserted`)

        // 5. Seed occasion_budget_allocations for Wedding (sample)
        const WEDDING_ALLOCATIONS = [
            { occasion_id: 'wedding', category_id: 'venue', percentage: 20, display_order: 1 },
            { occasion_id: 'wedding', category_id: 'decor', percentage: 10, display_order: 2 },
            { occasion_id: 'wedding', category_id: 'menu', percentage: 20, display_order: 3 },
            { occasion_id: 'wedding', category_id: 'photo-video', percentage: 10, display_order: 4 },
            { occasion_id: 'wedding', category_id: 'salon-mehndi', percentage: 5, display_order: 5 },
            { occasion_id: 'wedding', category_id: 'dj-sound-band', percentage: 8, display_order: 6 },
            { occasion_id: 'wedding', category_id: 'florist-flower-decor', percentage: 7, display_order: 7 },
            { occasion_id: 'wedding', category_id: 'event-management', percentage: 10, display_order: 8 },
            { occasion_id: 'wedding', category_id: 'priest-pandit', percentage: 3, display_order: 9 },
            { occasion_id: 'wedding', category_id: 'cars', percentage: 4, display_order: 10 },
            { occasion_id: 'wedding', category_id: 'fire-crackers', percentage: 3, display_order: 11 },
        ]
        const { error: allocErr } = await supabase
            .from('occasion_budget_allocations')
            .upsert(WEDDING_ALLOCATIONS, { onConflict: 'occasion_id,category_id' })
        if (allocErr) results.push(`Budget allocations error: ${allocErr.message}`)
        else results.push(`Budget allocations: ${WEDDING_ALLOCATIONS.length} upserted for Wedding`)

        return NextResponse.json({ success: true, results })
    } catch (e) {
        return NextResponse.json({ error: (e as Error).message, results }, { status: 500 })
    }
}
