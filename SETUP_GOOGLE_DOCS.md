# Google Docs Export Setup

To enable Google Docs export functionality, you need to set up a Google Cloud service account.

## Prerequisites

1. Google Cloud Console account
2. A Google Cloud project

## Setup Steps

### 1. Enable APIs

1. Go to [Google Cloud Console](https://console.cloud.google.com/)
2. Select your project or create a new one
3. Navigate to **APIs & Services** > **Library**
4. Enable the following APIs:
   - Google Docs API
   - Google Drive API

### 2. Create Service Account

1. Go to **APIs & Services** > **Credentials**
2. Click **Create Credentials** > **Service Account**
3. Fill in the service account details:
   - Name: `quote-extractor-docs`
   - Description: `Service account for Quote Extractor Google Docs export`
4. Click **Create and Continue**

### 3. Grant Permissions

1. In the service account roles section, add:
   - **Editor** role (for creating documents)
   - Or create a custom role with specific permissions:
     - `docs.documents.create`
     - `docs.documents.get`
     - `docs.documents.update`
     - `drive.files.create`
     - `drive.permissions.create`

### 4. Generate Key

1. Click on the created service account
2. Go to **Keys** tab
3. Click **Add Key** > **Create New Key**
4. Choose **JSON** format
5. Download the JSON file

### 5. Configure Environment

1. Copy the contents of the downloaded JSON file
2. Add it to your `.env` file as `GOOGLE_SERVICE_ACCOUNT_JSON`:

```env
GOOGLE_SERVICE_ACCOUNT_JSON='{"type":"service_account","project_id":"your-project",...}'
```

**Important**: The entire JSON should be on one line, wrapped in single quotes.

## Testing

Once configured, test the export functionality:

1. Add a YouTube video to the app
2. Wait for transcription to complete
3. Select some text to create quotes
4. Click the **Export to Google Docs** button in the Quotes panel
5. You should see a success message with a link to the created document

## Troubleshooting

### "Google service account not configured"
- Ensure `GOOGLE_SERVICE_ACCOUNT_JSON` is set in your environment variables
- Restart your development server after adding the environment variable

### "Invalid Google credentials"
- Verify the JSON format is correct (no extra spaces or line breaks)
- Ensure the service account key is valid and not expired

### "Google API quota exceeded"
- Check your API usage in Google Cloud Console
- Ensure you have sufficient quota for the Google Docs and Drive APIs

### "Permission denied" errors
- Verify the service account has the correct roles assigned
- Ensure the APIs are enabled in your Google Cloud project

## Security Notes

- Keep your service account key secure and never commit it to version control
- Consider using Google Cloud IAM conditions to restrict access if needed
- Regularly rotate service account keys for enhanced security