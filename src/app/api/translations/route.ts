import { supabase } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'

// Public endpoint for the mobile app to fetch translations
export async function GET() {
    const { data: translations, error } = await supabase
        .from('translations')
        .select('key, en, hi, "or"')
        .order('key', { ascending: true })

    if (error) {
        // If table doesn't exist, return default translations
        if (error.code === '42P01') {
            return NextResponse.json(getDefaultTranslationsForApp())
        }
        return NextResponse.json({ error: error.message }, { status: 500 })
    }

    // Convert to format expected by i18next
    const result = {
        en: {} as Record<string, string>,
        hi: {} as Record<string, string>,
        or: {} as Record<string, string>,
    }

    translations?.forEach((t: any) => {
        if (t.key) {
            result.en[t.key] = t.en || ''
            result.hi[t.key] = t.hi || ''
            result.or[t.key] = t['or'] || t.or || ''
        }
    })

    return NextResponse.json(result)
}

function getDefaultTranslationsForApp() {
    return {
        en: {
            splash_tagline: 'Celebrating Togetherness with Trust and Care',
            vendor_app: 'Vendor App',
            coming_together: 'Coming Together',
            login: 'Login',
            verify: 'Verify',
            dashboard: 'Dashboard',
            services: 'Services',
            calendar: 'Calendar',
            bookings: 'Bookings',
            profile: 'Profile',
            select_language: 'Select Language',
            total_revenue: 'Total Revenue',
            active_bookings: 'Active Bookings',
            upcoming_bookings: 'Upcoming Bookings',
            quick_actions: 'Quick Actions',
            quotations: 'Quotations',
            manage: 'Manage',
            select_service: 'Select Service',
            amount: 'Amount',
            valid_until: 'Valid Until',
            terms: 'Terms & Conditions',
            save: 'Save',
            create_quotation: 'Create Quotation',
            generate_receipt: 'Generate Receipt',
            thank_you: 'Thank You',
            settings: 'Settings',
            contact_support: 'Contact Support',
            phone_support: 'Phone Support',
            email_support: 'Email Support',
            support_hours: 'Support Hours',
        },
        hi: {
            splash_tagline: 'विश्वास और देखभाल के साथ एकजुटता का जश्न मनाना',
            vendor_app: 'वेंडर ऐप',
            coming_together: 'एक साथ आना',
            login: 'लॉगिन',
            verify: 'सत्यापित करें',
            dashboard: 'डैशबोर्ड',
            services: 'सेवाएं',
            calendar: 'कैलेंडर',
            bookings: 'बुकिंग',
            profile: 'प्रोफ़ाइल',
            select_language: 'भाषा चुनें',
            total_revenue: 'कुल आय',
            active_bookings: 'सक्रिय बुकिंग',
            upcoming_bookings: 'आगामी बुकिंग',
            quick_actions: 'त्वरित कार्रवाई',
            quotations: 'कोटेशन',
            manage: 'प्रबंधित करें',
            select_service: 'सेवा चुनें',
            amount: 'राशि',
            valid_until: 'तक मान्य',
            terms: 'नियम और शर्तें',
            save: 'सहेजें',
            create_quotation: 'कोटेशन बनाएं',
            generate_receipt: 'रसीद जनरेट करें',
            thank_you: 'धन्यवाद',
            settings: 'सेटिंग्स',
            contact_support: 'सहायता से संपर्क करें',
            phone_support: 'फोन सहायता',
            email_support: 'ईमेल सहायता',
            support_hours: 'सहायता समय',
        },
        or: {
            splash_tagline: 'ଏକତ୍ରୀତ ହବା ପାଇଁ ଏକତ୍ର ହିଁ ଏକମାତ୍ର ଭରୋସା ଓ ସାହାରା',
            vendor_app: 'ଭେଣ୍ଡର ଆପ୍',
            coming_together: 'ଏକାଠି ହେବା',
            login: 'ଲଗଇନ୍',
            verify: 'ଯାଞ୍ଚ କରନ୍ତୁ',
            dashboard: 'ଡ୍ୟାସବୋର୍ଡ',
            services: 'ସେବାଗୁଡିକ',
            calendar: 'କ୍ୟାଲେଣ୍ଡର',
            bookings: 'ବୁକିଂ',
            profile: 'ପ୍ରୋଫାଇଲ୍',
            select_language: 'ଭାଷା ବାଛନ୍ତୁ',
            total_revenue: 'ସମୁଦାୟ ରାଜସ୍ୱ',
            active_bookings: 'ସକ୍ରିୟ ବୁକିଂ',
            upcoming_bookings: 'ଆଗାମୀ ବୁକିଂ',
            quick_actions: 'କ୍ଷୀପ୍ର କାର୍ଯ୍ୟାନୁଷ୍ଠାନ',
            quotations: 'କ୍ଵୋଟେସନ୍',
            manage: 'ପରିଚାଳନା କରନ୍ତୁ',
            select_service: 'ସେବା ବାଛନ୍ତୁ',
            amount: 'ପରିମାଣ',
            valid_until: 'ପର୍ଯ୍ୟନ୍ତ ବୈଧ',
            terms: 'ନିୟମ ଏବଂ ସର୍ତ୍ତ',
            save: 'ସଂରକ୍ଷଣ କରନ୍ତୁ',
            create_quotation: 'କ୍ଵୋଟେସନ୍ ପ୍ରସ୍ତୁତ କରନ୍ତୁ',
            generate_receipt: 'ରସିଦ ପ୍ରସ୍ତୁତ କରନ୍ତୁ',
            thank_you: 'ଧନ୍ୟବାଦ',
            settings: 'ସେଟିଂସଙ୍ଗ',
            contact_support: 'ସମର୍ଥନ ଯୋଗାଯୋଗ କରନ୍ତୁ',
            phone_support: 'ଫୋନ୍ ସମର୍ଥନ',
            email_support: 'ଇମେଲ୍ ସମର୍ଥନ',
            support_hours: 'ସମର୍ଥନ ସମୟ',
        }
    }
}

