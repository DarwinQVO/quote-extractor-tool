export interface YouTubeDLInfo {
  title?: string;
  uploader?: string;
  channel?: string;
  duration?: number;
  thumbnail?: string;
  description?: string;
  upload_date?: string;
  view_count?: number;
  formats?: Array<{
    format_id: string;
    ext: string;
    url: string;
  }>;
}