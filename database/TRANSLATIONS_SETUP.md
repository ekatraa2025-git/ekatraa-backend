# Translations Table Setup Guide

## Database Schema

The `translations` table has been created to store all language translations for the vendor app. The schema includes:

- **key**: Primary key (TEXT) - Unique identifier for each translation
- **en**: English translation (TEXT)
- **hi**: Hindi translation (TEXT)  
- **or**: Odia translation (TEXT)
- **created_at**: Timestamp when record was created
- **updated_at**: Timestamp when record was last updated

## Setup Instructions

1. **Run the SQL script in Supabase:**
   - Go to your Supabase project
   - Navigate to SQL Editor
   - Copy and paste the contents of `database/translations.sql`
   - Execute the script

2. **Verify the table was created:**
   - Go to Table Editor in Supabase
   - You should see the `translations` table
   - It should be pre-populated with default translations

## How It Works

### Backend (Admin Panel)
- Admin can view, create, edit, and delete translations at `/admin/translations`
- Changes are saved directly to the `translations` table
- The API endpoint `/api/translations` serves translations to the mobile app

### Mobile App (Vendor App)
- App loads default translations on startup
- Then fetches latest translations from backend API
- Translations are refreshed:
  - On app startup
  - When app comes to foreground
  - Every 5 minutes automatically
  - When user changes language
- All changes made in admin panel are automatically reflected in the app

## API Endpoints

### Public Endpoint (for mobile app)
- **GET** `/api/translations`
- Returns translations in format: `{ en: {...}, hi: {...}, or: {...} }`
- No authentication required (public read access)

### Admin Endpoint
- **GET** `/api/admin/translations` - List all translations
- **POST** `/api/admin/translations` - Create/Update translation
- **DELETE** `/api/admin/translations?key=translation_key` - Delete translation

## Adding New Translations

1. Go to `/admin/translations` in the backend
2. Click "Add Translation"
3. Enter:
   - **Key**: Unique identifier (e.g., `welcome_message`)
   - **English**: English text
   - **Hindi**: Hindi text (हिन्दी)
   - **Odia**: Odia text (ଓଡ଼ିଆ)
4. Click "Save"

The translation will be immediately available to the mobile app on next refresh.

## Notes

- Translations are cached in the mobile app for performance
- App automatically refreshes translations periodically
- Changes in admin panel are reflected globally across all vendor app instances
- The table uses Row Level Security (RLS) - public read, authenticated write
