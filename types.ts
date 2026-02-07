export interface PikPakLoginResponse {
  token_type: string;
  access_token: string;
  refresh_token: string;
  expires_in: number;
  sub: string;
}

export interface PikPakFile {
  id: string;
  kind: string;
  name: string;
  size: string;
  mime_type: string;
  created_time: string;
  modified_time: string;
  icon_link: string;
  thumbnail_link: string;
  web_content_link?: string; // Download link
  params?: {
    platform_icon?: string;
  };
  folder_type?: string;
}

export interface PikPakTask {
  task: {
    id: string;
    name: string;
    type: string;
    file_id: string;
    file_name: string;
    status: string; // "PHASE_TYPE_COMPLETE", "PHASE_TYPE_RUNNING"
    progress: number;
  }
}

export interface TaskStatus {
  id: string; // Task ID
  fileId?: string; // Resulting File ID
  name: string;
  status: 'pending' | 'downloading' | 'complete' | 'error';
  progress: number;
  magnet: string;
  timestamp: number;
}
