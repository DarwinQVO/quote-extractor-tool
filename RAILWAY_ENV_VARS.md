# Railway Environment Variables

## REQUIRED: Bright Data Proxy Configuration

Add these environment variables in Railway Dashboard:

```bash
# Bright Data Proxy (CRITICAL)
YTDLP_PROXY=http://brd-customer-hl_16699f5c-zone-residential_proxy1:j24ifit7dkc6@brd.superproxy.io:33335

# Optional: YouTube API for enhanced caption extraction
YOUTUBE_API_KEY=your_youtube_api_key

# Optional: Home IP for WireGuard fallback
HOME_IP=192.168.1.100

# Existing variables (keep these)
OPENAI_API_KEY=your_openai_key
SUPABASE_URL=your_supabase_url
SUPABASE_ANON_KEY=your_supabase_key
```

## Railway Deployment Steps:

1. Go to Railway Dashboard → Your Project → Variables
2. Add `YTDLP_PROXY` with the Bright Data URL above
3. Deploy changes
4. Test with a YouTube video

## Proxy Strategy Priority:

1. **E3_BrightData_Proxy** (FIRST - highest success rate)
2. E1_Cookies_UA_Residencial  
3. E2_PO_Token
4. E4_WireGuard_Home

The system will automatically use your Bright Data proxy as the primary strategy for both metadata extraction and audio download.