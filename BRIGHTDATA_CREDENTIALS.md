# 🌐 Bright Data Configuration for Railway

Based on your working curl command, configure these **exact** variables in Railway:

## Railway Dashboard → Environment Variables

```ini
PROXY_HOST=brd.superproxy.io
PROXY_PORT=33335
PROXY_USER=brd-customer-hl_16699f5c-zone-residential_proxy1
PROXY_PASS=j24ifit7dkc6
WHISPER_MODEL_SIZE=medium
```

## ✅ Your Working curl Command:
```bash
curl -i --proxy brd.superproxy.io:33335 \
  --proxy-user brd-customer-hl_16699f5c-zone-residential_proxy1:j24ifit7dkc6 \
  -k "https://geo.brdtest.com/welcome.txt?product=resi&method=native"
```

## 🔧 Important Notes:

1. **User Format**: Your user includes zone info: `brd-customer-hl_16699f5c-zone-residential_proxy1`
2. **Special Characters**: The `-` and `_` in username are now URL-encoded automatically
3. **Exact Copy**: Copy these values EXACTLY to Railway (no extra spaces)

## 🧪 After Setting Variables:

1. **Redeploy** your Railway app
2. **Test with new video** 
3. **Check logs** for: `🔐 DEBUG: Proxy URL format`

## 🚨 Security Note:

Delete this file after configuring Railway to avoid exposing credentials in git history.