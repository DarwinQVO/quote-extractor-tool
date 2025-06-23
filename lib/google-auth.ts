import { GoogleAuth } from 'google-auth-library';
import { docs_v1, google } from 'googleapis';

let authClient: GoogleAuth | null = null;

export function getGoogleAuth(): GoogleAuth {
  if (!authClient) {
    const serviceAccountJson = process.env.GOOGLE_SERVICE_ACCOUNT_JSON;
    
    if (!serviceAccountJson) {
      throw new Error('GOOGLE_SERVICE_ACCOUNT_JSON environment variable is required');
    }
    
    let credentials;
    try {
      credentials = JSON.parse(serviceAccountJson);
    } catch {
      throw new Error('Invalid GOOGLE_SERVICE_ACCOUNT_JSON format');
    }
    
    authClient = new GoogleAuth({
      credentials,
      scopes: [
        'https://www.googleapis.com/auth/documents',
        'https://www.googleapis.com/auth/drive',
      ],
    });
  }
  
  return authClient;
}

export async function getDocsClient(): Promise<docs_v1.Docs> {
  const auth = getGoogleAuth();
  return google.docs({ version: 'v1', auth });
}

export async function getDriveClient() {
  const auth = getGoogleAuth();
  return google.drive({ version: 'v3', auth });
}