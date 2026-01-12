-- Create translations table for Supabase
-- Run this SQL in your Supabase SQL Editor

CREATE TABLE IF NOT EXISTS translations (
    key TEXT PRIMARY KEY,
    en TEXT NOT NULL DEFAULT '',
    hi TEXT NOT NULL DEFAULT '',
    "or" TEXT NOT NULL DEFAULT '',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create index for faster queries
CREATE INDEX IF NOT EXISTS idx_translations_key ON translations(key);

-- Create function to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_translations_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Drop trigger if exists, then create
DROP TRIGGER IF EXISTS update_translations_updated_at ON translations;
CREATE TRIGGER update_translations_updated_at
    BEFORE UPDATE ON translations
    FOR EACH ROW
    EXECUTE FUNCTION update_translations_updated_at();

-- Insert default translations
INSERT INTO translations (key, en, hi, "or") VALUES
    ('splash_tagline', 'Celebrating Togetherness with Trust and Care', 'विश्वास और देखभाल के साथ एकजुटता का जश्न मनाना', 'ଏକତ୍ରୀତ ହବା ପାଇଁ ଏକତ୍ର ହିଁ ଏକମାତ୍ର ଭରୋସା ଓ ସାହାରା')
ON CONFLICT (key) DO NOTHING;

INSERT INTO translations (key, en, hi, "or") VALUES
    ('vendor_app', 'Vendor App', 'वेंडर ऐप', 'ଭେଣ୍ଡର ଆପ୍'),
    ('coming_together', 'Coming Together', 'एक साथ आना', 'ଏକାଠି ହେବା'),
    ('login', 'Login', 'लॉगिन', 'ଲଗଇନ୍'),
    ('verify', 'Verify', 'सत्यापित करें', 'ଯାଞ୍ଚ କରନ୍ତୁ'),
    ('dashboard', 'Dashboard', 'डैशबोर्ड', 'ଡ୍ୟାସବୋର୍ଡ'),
    ('services', 'Services', 'सेवाएं', 'ସେବାଗୁଡିକ'),
    ('calendar', 'Calendar', 'कैलेंडर', 'କ୍ୟାଲେଣ୍ଡର'),
    ('bookings', 'Bookings', 'बुकिंग', 'ବୁକିଂ'),
    ('profile', 'Profile', 'प्रोफ़ाइल', 'ପ୍ରୋଫାଇଲ୍'),
    ('select_language', 'Select Language', 'भाषा चुनें', 'ଭାଷା ବାଛନ୍ତୁ'),
    ('total_revenue', 'Total Revenue', 'कुल आय', 'ସମୁଦାୟ ରାଜସ୍ୱ'),
    ('active_bookings', 'Active Bookings', 'सक्रिय बुकिंग', 'ସକ୍ରିୟ ବୁକିଂ'),
    ('upcoming_bookings', 'Upcoming Bookings', 'आगामी बुकिंग', 'ଆଗାମୀ ବୁକିଂ'),
    ('quick_actions', 'Quick Actions', 'त्वरित कार्रवाई', 'କ୍ଷୀପ୍ର କାର୍ଯ୍ୟାନୁଷ୍ଠାନ'),
    ('quotations', 'Quotations', 'कोटेशन', 'କ୍ଵୋଟେସନ୍'),
    ('manage', 'Manage', 'प्रबंधित करें', 'ପରିଚାଳନା କରନ୍ତୁ'),
    ('select_service', 'Select Service', 'सेवा चुनें', 'ସେବା ବାଛନ୍ତୁ'),
    ('amount', 'Amount', 'राशि', 'ପରିମାଣ'),
    ('valid_until', 'Valid Until', 'तक मान्य', 'ପର୍ଯ୍ୟନ୍ତ ବୈଧ'),
    ('terms', 'Terms & Conditions', 'नियम और शर्तें', 'ନିୟମ ଏବଂ ସର୍ତ୍ତ'),
    ('save', 'Save', 'सहेजें', 'ସଂରକ୍ଷଣ କରନ୍ତୁ'),
    ('create_quotation', 'Create Quotation', 'कोटेशन बनाएं', 'କ୍ଵୋଟେସନ୍ ପ୍ରସ୍ତୁତ କରନ୍ତୁ'),
    ('generate_receipt', 'Generate Receipt', 'रसीद जनरेट करें', 'ରସିଦ ପ୍ରସ୍ତୁତ କରନ୍ତୁ'),
    ('thank_you', 'Thank You', 'धन्यवाद', 'ଧନ୍ୟବାଦ'),
    ('settings', 'Settings', 'सेटिंग्स', 'ସେଟିଂସଙ୍ଗ'),
    ('contact_support', 'Contact Support', 'सहायता से संपर्क करें', 'ସମର୍ଥନ ଯୋଗାଯୋଗ କରନ୍ତୁ'),
    ('phone_support', 'Phone Support', 'फोन सहायता', 'ଫୋନ୍ ସମର୍ଥନ'),
    ('email_support', 'Email Support', 'ईमेल सहायता', 'ଇମେଲ୍ ସମର୍ଥନ'),
    ('support_hours', 'Support Hours', 'सहायता समय', 'ସମର୍ଥନ ସମୟ'),
    ('business_profile', 'Business Profile', 'व्यवसाय प्रोफ़ाइल', 'ବ୍ୟବସାୟ ପ୍ରୋଫାଇଲ୍'),
    ('tell_us_about_business', 'Tell us about your service or business', 'अपनी सेवा या व्यवसाय के बारे में बताएं', 'ଆପଣଙ୍କ ସେବା କିମ୍ବା ବ୍ୟବସାୟ ବିଷୟରେ କୁହନ୍ତୁ'),
    ('upload_logo_or_profile', 'Upload Logo or Profile Picture', 'लोगो या प्रोफ़ाइल चित्र अपलोड करें', 'ଲୋଗୋ କିମ୍ବା ପ୍ରୋଫାଇଲ୍ ଚିତ୍ର ଅପଲୋଡ୍ କରନ୍ତୁ'),
    ('business_name', 'Business Name', 'व्यवसाय का नाम', 'ବ୍ୟବସାୟର ନାମ'),
    ('business_name_placeholder', 'e.g. Royal Catering Services', 'उदाहरण: रॉयल केटरिंग सर्विसेज', 'ଉଦାହରଣ: ରୟାଲ୍ କ୍ୟାଟରିଂ ସେବା'),
    ('business_category', 'Business Category', 'व्यवसाय श्रेणी', 'ବ୍ୟବସାୟ ବର୍ଗ'),
    ('select_category', 'Select Category', 'श्रेणी चुनें', 'ବର୍ଗ ବାଛନ୍ତୁ'),
    ('brief_description', 'Brief Description', 'संक्षिप्त विवरण', 'ସଂକ୍ଷିପ୍ତ ବିବରଣୀ'),
    ('description_placeholder', 'Tell clients what makes you special...', 'ग्राहकों को बताएं कि आप क्या खास हैं...', 'କ୍ଲାଇଣ୍ଟମାନଙ୍କୁ କୁହନ୍ତୁ ଯେ ଆପଣ କଣ ବିଶେଷ...'),
    ('location_and_contact', 'Location & Contact', 'स्थान और संपर्क', 'ସ୍ଥାନ ଏବଂ ସମ୍ପର୍କ'),
    ('where_can_clients_reach', 'Where can clients reach you?', 'ग्राहक आपसे कहाँ संपर्क कर सकते हैं?', 'କ୍ଲାଇଣ୍ଟମାନେ ଆପଣଙ୍କୁ କେଉଁଠାରେ ସମ୍ପର୍କ କରିପାରିବେ?'),
    ('official_phone_number', 'Official Phone Number', 'आधिकारिक फोन नंबर', 'ଅଧିକାରିକ ଫୋନ୍ ନମ୍ବର'),
    ('verified_phone_number', '✓ Verified Phone Number', '✓ सत्यापित फोन नंबर', '✓ ଯାଞ୍ଚିତ ଫୋନ୍ ନମ୍ବର'),
    ('service_location_address', 'Service Location / Address', 'सेवा स्थान / पता', 'ସେବା ସ୍ଥାନ / ଠିକଣା'),
    ('pinpoint_on_map', 'Pinpoint on Map', 'मानचित्र पर स्थान चिह्नित करें', 'ମାନଚିତ୍ରରେ ସ୍ଥାନ ଚିହ୍ନିତ କରନ୍ତୁ'),
    ('auto_detect', 'Auto-detect', 'स्वचालित पता लगाएं', 'ସ୍ୱଚାଳିତ ଠିକଣା ଖୋଜନ୍ତୁ'),
    ('search_area_or_address', 'Search area or enter full address...', 'क्षेत्र खोजें या पूरा पता दर्ज करें...', 'କ୍ଷେତ୍ର ଖୋଜନ୍ତୁ କିମ୍ବା ସମ୍ପୂର୍ଣ୍ଣ ଠିକଣା ପ୍ରବେଶ କରନ୍ତୁ...'),
    ('your_listings', 'Your Listings', 'आपकी सूचियाँ', 'ଆପଣଙ୍କର ତାଲିକା'),
    ('you_have_service_active', 'You have {{count}} service active', 'आपके पास {{count}} सेवा सक्रिय है', 'ଆପଣଙ୍କର {{count}} ସେବା ସକ୍ରିୟ ଅଛି'),
    ('you_have_services_active', 'You have {{count}} services active', 'आपके पास {{count}} सेवाएं सक्रिय हैं', 'ଆପଣଙ୍କର {{count}} ସେବା ସକ୍ରିୟ ଅଛନ୍ତି'),
    ('profile_ready', 'Profile Ready!', 'प्रोफ़ाइल तैयार!', 'ପ୍ରୋଫାଇଲ୍ ପ୍ରସ୍ତୁତ!'),
    ('profile_ready_description', 'Your existing services are listed. You''re ready to start receiving new bookings.', 'आपकी मौजूदा सेवाएं सूचीबद्ध हैं। आप नई बुकिंग प्राप्त करना शुरू करने के लिए तैयार हैं।', 'ଆପଣଙ୍କର ବିଦ୍ୟମାନ ସେବାଗୁଡିକ ତାଲିକାଭୁକ୍ତ। ଆପଣ ନୂଆ ବୁକିଂ ଗ୍ରହଣ କରିବା ଆରମ୍ଭ କରିବାକୁ ପ୍ରସ୍ତୁତ।'),
    ('manage_catalog', 'Manage Catalog', 'कैटलॉग प्रबंधित करें', 'କ୍ୟାଟାଲଗ୍ ପରିଚାଳନା କରନ୍ତୁ'),
    ('add_or_edit_services', 'Add or edit more services', 'अधिक सेवाएं जोड़ें या संपादित करें', 'ଅଧିକ ସେବା ଯୋଡନ୍ତୁ କିମ୍ବା ସମ୍ପାଦନା କରନ୍ତୁ'),
    ('starter_service', 'Starter Service', 'शुरुआती सेवा', 'ଆରମ୍ଭ ସେବା'),
    ('add_primary_listing', 'Add your primary listing to get started', 'शुरू करने के लिए अपनी प्राथमिक सूची जोड़ें', 'ଆରମ୍ଭ କରିବାକୁ ଆପଣଙ୍କର ପ୍ରାଥମିକ ତାଲିକା ଯୋଡନ୍ତୁ'),
    ('upload_cover_photo', 'Upload Cover Photo', 'कवर फोटो अपलोड करें', 'କଭର୍ ଫଟୋ ଅପଲୋଡ୍ କରନ୍ତୁ'),
    ('showcase_best_work', 'Showcase your best work to attract high-value clients.', 'उच्च-मूल्य वाले ग्राहकों को आकर्षित करने के लिए अपना सर्वश्रेष्ठ काम प्रदर्शित करें।', 'ଉଚ୍ଚ-ମୂଲ୍ୟର କ୍ଲାଇଣ୍ଟମାନଙ୍କୁ ଆକର୍ଷଣ କରିବାକୁ ଆପଣଙ୍କର ସର୍ବଶ୍ରେଷ୍ଠ କାମ ପ୍ରଦର୍ଶନ କରନ୍ତୁ।'),
    ('listing_name', 'Listing Name', 'सूची का नाम', 'ତାଲିକାର ନାମ'),
    ('listing_name_placeholder', 'e.g. Premium Wedding Photography', 'उदाहरण: प्रीमियम वेडिंग फोटोग्राफी', 'ଉଦାହରଣ: ପ୍ରିମିୟମ୍ ବିବାହ ଫୋଟୋଗ୍ରାଫି'),
    ('base_package_price', 'Base Package Price (₹)', 'आधार पैकेज मूल्य (₹)', 'ଆଧାର ପ୍ୟାକେଜ୍ ମୂଲ୍ୟ (₹)'),
    ('price_placeholder', 'e.g. 25000', 'उदाहरण: 25000', 'ଉଦାହରଣ: 25000'),
    ('registration', 'Registration', 'पंजीकरण', 'ପଞ୍ଜୀକରଣ'),
    ('step', 'Step', 'चरण', 'ପଦକ୍ଷେପ'),
    ('syncing_profile', 'Syncing your profile...', 'आपकी प्रोफ़ाइल सिंक हो रही है...', 'ଆପଣଙ୍କର ପ୍ରୋଫାଇଲ୍ ସିଙ୍କ୍ ହେଉଛି...'),
    ('finalize_registration', 'Finalize Registration', 'पंजीकरण अंतिम रूप दें', 'ପଞ୍ଜୀକରଣ ଶେଷ କରନ୍ତୁ'),
    ('continue', 'Continue', 'जारी रखें', 'ଜାରି ରଖନ୍ତୁ'),
    ('previous_step', 'Previous Step', 'पिछला चरण', 'ପୂର୍ବବର୍ତ୍ତୀ ପଦକ୍ଷେପ'),
    ('loading', 'Loading...', 'लोड हो रहा है...', 'ଲୋଡ୍ ହେଉଛି...'),
    ('no_categories_found', 'No categories found', 'कोई श्रेणी नहीं मिली', 'କୌଣସି ବର୍ଗ ମିଳିଲା ନାହିଁ'),
    ('new_to_ekatraa', 'New to Ekatraa?', 'ईकत्रा में नए हैं?', 'ଇକତ୍ରାରେ ନୂଆ?'),
    ('start_by_adding_services', 'Start by adding your services and setting your availability in the calendar.', 'अपनी सेवाएं जोड़कर और कैलेंडर में अपनी उपलब्धता सेट करके शुरू करें।', 'ଆପଣଙ୍କର ସେବା ଯୋଡି ଏବଂ କ୍ୟାଲେଣ୍ଡରରେ ଆପଣଙ୍କର ଉପଲବ୍ଧତା ସେଟ୍ କରି ଆରମ୍ଭ କରନ୍ତୁ।'),
    ('learn_more', 'Learn More', 'अधिक जानें', 'ଅଧିକ ଜାଣନ୍ତୁ'),
    ('welcome_back', 'Welcome back', 'वापसी पर स्वागत है', 'ପୁନର୍ବାର ସ୍ୱାଗତ'),
    ('vendor', 'Vendor', 'विक्रेता', 'ବିକ୍ରେତା'),
    ('payout_methods', 'Payout Methods', 'भुगतान विधियाँ', 'ଦେୟ ପଦ୍ଧତି'),
    ('view_all', 'View All', 'सभी देखें', 'ସମସ୍ତ ଦେଖନ୍ତୁ'),
    ('no_upcoming_bookings', 'No upcoming bookings', 'कोई आगामी बुकिंग नहीं', 'କୌଣସି ଆଗାମୀ ବୁକିଂ ନାହିଁ'),
    ('total_services', 'Total Services', 'कुल सेवाएं', 'ସମୁଦାୟ ସେବା'),
    ('profile_views', 'Profile Views', 'प्रोफ़ाइल दृश्य', 'ପ୍ରୋଫାଇଲ୍ ଦର୍ଶନ'),
    ('booking', 'Booking', 'बुकिंग', 'ବୁକିଂ')
ON CONFLICT (key) DO NOTHING;

-- Grant necessary permissions
GRANT SELECT, INSERT, UPDATE, DELETE ON translations TO authenticated;
GRANT SELECT ON translations TO anon;

-- Enable Row Level Security (RLS) - Allow public read access for mobile app
ALTER TABLE translations ENABLE ROW LEVEL SECURITY;

-- Policy: Anyone can read translations (for mobile app)
CREATE POLICY "Translations are publicly readable"
    ON translations
    FOR SELECT
    USING (true);

-- Policy: Only authenticated users can modify (for admin panel)
CREATE POLICY "Authenticated users can modify translations"
    ON translations
    FOR ALL
    USING (auth.role() = 'authenticated')
    WITH CHECK (auth.role() = 'authenticated');
