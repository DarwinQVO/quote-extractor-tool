# 🚀 Supabase Setup Guide for Quote Extractor Tool

## 1. Create a Supabase Project

1. Go to [supabase.com](https://supabase.com) and sign up/login
2. Click "New project"
3. Fill in:
   - Name: `quote-extractor` (or any name you prefer)
   - Database Password: Generate a strong password
   - Region: Choose the closest to you
4. Click "Create new project" and wait ~2 minutes

## 2. Get Your API Keys

Once your project is created:

1. Go to Settings (gear icon) → API
2. Copy these values:
   - **Project URL**: `https://YOUR_PROJECT.supabase.co`
   - **Anon/Public Key**: `eyJhbGc...` (long string)

## 3. Set Up Database Tables

1. Go to SQL Editor (database icon)
2. Click "New query"
3. Copy and paste the entire contents of `supabase-setup.sql`
4. Click "Run" (or press Ctrl/Cmd + Enter)
5. You should see "Success. No rows returned"

## 4. Configure Railway Environment Variables

In your Railway project:

1. Go to your service → Variables tab
2. Add these variables:
   ```
   NEXT_PUBLIC_SUPABASE_URL=https://YOUR_PROJECT.supabase.co
   NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJhbGc...your-long-anon-key...
   ```
3. Railway will automatically redeploy

## 5. Verify Setup

After deployment completes:

1. Visit `your-app.railway.app/api/debug-env`
2. Check that:
   - `SUPABASE_URL_VALID: true`
   - `SUPABASE_KEY_VALID: true`

## 6. Test the Application

1. Go to your app homepage
2. Add a YouTube URL
3. Wait for transcription
4. Your colleague should see the same video immediately

## Troubleshooting

### "Supabase not configured" errors
- Double-check your environment variables in Railway
- Make sure there are no spaces or quotes around the values
- Ensure the URL includes `https://` and ends with `.supabase.co`

### Tables not found errors
- Re-run the SQL setup script
- Check the Table Editor in Supabase to confirm tables exist

### Data not syncing between users
- Verify RLS policies are enabled (they should be from the script)
- Check that both users are using the same deployment URL

## Security Notes

- The Anon key is safe to expose (it's meant for client-side use)
- For production, consider adding authentication
- Monitor your Supabase dashboard for usage

## Support

If you have issues:
1. Check Supabase logs: Authentication → Logs
2. Check Railway logs for any errors
3. Visit `/api/debug-env` to verify configuration