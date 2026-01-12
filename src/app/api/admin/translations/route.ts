import { supabase } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'

export async function GET() {
    const { data: translations, error } = await supabase
        .from('translations')
        .select('*')
        .order('key', { ascending: true })

    if (error) {
        // If table doesn't exist, return default translations
        if (error.code === '42P01') {
            return NextResponse.json({
                translations: getDefaultTranslations(),
                message: 'Using default translations. Create translations table to enable editing.'
            })
        }
        return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json(translations || [])
}

export async function POST(req: Request) {
    try {
        const body = await req.json()
        const { key, en, hi, or: odia } = body

        if (!key) {
            return NextResponse.json({ error: 'Key is required' }, { status: 400 })
        }

        const { data, error } = await supabase
            .from('translations')
            .upsert({
                key,
                en: en || '',
                hi: hi || '',
                or: odia || '',
                updated_at: new Date().toISOString()
            }, { onConflict: 'key' })
            .select()
            .single()

        if (error) {
            return NextResponse.json({ error: error.message }, { status: 500 })
        }

        return NextResponse.json(data)
    } catch (error: any) {
        return NextResponse.json({ error: error.message }, { status: 500 })
    }
}

export async function DELETE(req: Request) {
    try {
        const { searchParams } = new URL(req.url)
        const key = searchParams.get('key')

        if (!key) {
            return NextResponse.json({ error: 'Key is required' }, { status: 400 })
        }

        const { error } = await supabase
            .from('translations')
            .delete()
            .eq('key', key)

        if (error) {
            return NextResponse.json({ error: error.message }, { status: 500 })
        }

        return NextResponse.json({ success: true, message: 'Translation deleted successfully' })
    } catch (error: any) {
        return NextResponse.json({ error: error.message }, { status: 500 })
    }
}

function getDefaultTranslations() {
    return [
        { key: 'splash_tagline', en: 'Celebrating Togetherness with Trust and Care', hi: 'विश्वास और देखभाल के साथ एकजुटता का जश्न मनाना', or: 'ଏକତ୍ରୀତ ହବା ପାଇଁ ଏକତ୍ର ହିଁ ଏକମାତ୍ର ଭରୋସା ଓ ସାହାରା' },
        { key: 'vendor_app', en: 'Vendor App', hi: 'वेंडर ऐप', or: 'ଭେଣ୍ଡର ଆପ୍' },
        { key: 'coming_together', en: 'Coming Together', hi: 'एक साथ आना', or: 'ଏକାଠି ହେବା' },
        { key: 'login', en: 'Login', hi: 'लॉगिन', or: 'ଲଗଇନ୍' },
        { key: 'verify', en: 'Verify', hi: 'सत्यापित करें', or: 'ଯାଞ୍ଚ କରନ୍ତୁ' },
        { key: 'dashboard', en: 'Dashboard', hi: 'डैशबोर्ड', or: 'ଡ୍ୟାସବୋର୍ଡ' },
        { key: 'services', en: 'Services', hi: 'सेवाएं', or: 'ସେବାଗୁଡିକ' },
        { key: 'calendar', en: 'Calendar', hi: 'कैलेंडर', or: 'କ୍ୟାଲେଣ୍ଡର' },
        { key: 'bookings', en: 'Bookings', hi: 'बुकिंग', or: 'ବୁକିଂ' },
        { key: 'profile', en: 'Profile', hi: 'प्रोफ़ाइल', or: 'ପ୍ରୋଫାଇଲ୍' },
        { key: 'select_language', en: 'Select Language', hi: 'भाषा चुनें', or: 'ଭାଷା ବାଛନ୍ତୁ' },
        { key: 'total_revenue', en: 'Total Revenue', hi: 'कुल आय', or: 'ସମୁଦାୟ ରାଜସ୍ୱ' },
        { key: 'active_bookings', en: 'Active Bookings', hi: 'सक्रिय बुकिंग', or: 'ସକ୍ରିୟ ବୁକିଂ' },
        { key: 'upcoming_bookings', en: 'Upcoming Bookings', hi: 'आगामी बुकिंग', or: 'ଆଗାମୀ ବୁକିଂ' },
        { key: 'quick_actions', en: 'Quick Actions', hi: 'त्वरित कार्रवाई', or: 'କ୍ଷୀପ୍ର କାର୍ଯ୍ୟାନୁଷ୍ଠାନ' },
        { key: 'quotations', en: 'Quotations', hi: 'कोटेशन', or: 'କ୍ଵୋଟେସନ୍' },
        { key: 'manage', en: 'Manage', hi: 'प्रबंधित करें', or: 'ପରିଚାଳନା କରନ୍ତୁ' },
        { key: 'select_service', en: 'Select Service', hi: 'सेवा चुनें', or: 'ସେବା ବାଛନ୍ତୁ' },
        { key: 'amount', en: 'Amount', hi: 'राशि', or: 'ପରିମାଣ' },
        { key: 'valid_until', en: 'Valid Until', hi: 'तक मान्य', or: 'ପର୍ଯ୍ୟନ୍ତ ବୈଧ' },
        { key: 'terms', en: 'Terms & Conditions', hi: 'नियम और शर्तें', or: 'ନିୟମ ଏବଂ ସର୍ତ୍ତ' },
        { key: 'save', en: 'Save', hi: 'सहेजें', or: 'ସଂରକ୍ଷଣ କରନ୍ତୁ' },
        { key: 'create_quotation', en: 'Create Quotation', hi: 'कोटेशन बनाएं', or: 'କ୍ଵୋଟେସନ୍ ପ୍ରସ୍ତୁତ କରନ୍ତୁ' },
        { key: 'generate_receipt', en: 'Generate Receipt', hi: 'रसीद जनरेट करें', or: 'ରସିଦ ପ୍ରସ୍ତୁତ କରନ୍ତୁ' },
        { key: 'thank_you', en: 'Thank You', hi: 'धन्यवाद', or: 'ଧନ୍ୟବାଦ' },
        { key: 'settings', en: 'Settings', hi: 'सेटिंग्स', or: 'ସେଟିଂସଙ୍ଗ' },
        { key: 'contact_support', en: 'Contact Support', hi: 'सहायता से संपर्क करें', or: 'ସମର୍ଥନ ଯୋଗାଯୋଗ କରନ୍ତୁ' },
        { key: 'phone_support', en: 'Phone Support', hi: 'फोन सहायता', or: 'ଫୋନ୍ ସମର୍ଥନ' },
        { key: 'email_support', en: 'Email Support', hi: 'ईमेल सहायता', or: 'ଇମେଲ୍ ସମର୍ଥନ' },
        { key: 'support_hours', en: 'Support Hours', hi: 'सहायता समय', or: 'ସମର୍ଥନ ସମୟ' },
    ]
}

