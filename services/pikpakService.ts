import { PikPakLoginResponse, PikPakFile, PikPakTask } from '../types';

// NOTE: When running locally without the Nginx proxy, you might hit CORS errors.
// The Docker setup provided in the solution includes an Nginx reverse proxy to handle this.
// API_BASE is set to a relative path assuming the Nginx proxy is serving /api/pikpak -> https://api-drive.mypikpak.com
// and /api/auth -> https://user.mypikpak.com

const AUTH_API_BASE = '/api/auth/v1';
const DRIVE_API_BASE = '/api/drive/v1';

export const PikPakService = {
  
  async login(username: string, password: string): Promise<PikPakLoginResponse> {
    const response = await fetch(`${AUTH_API_BASE}/auth/signin`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        username,
        password,
        client_id: "YNxT9w7GMvwDryEF", // Common Web Client ID
      }),
    });

    if (!response.ok) {
      const err = await response.json();
      throw new Error(err.error_description || 'Login failed');
    }

    return response.json();
  },

  async addMagnet(magnetUrl: string, accessToken: string): Promise<PikPakTask> {
    // 1. We initiate a file upload of type 'url'
    const response = await fetch(`${DRIVE_API_BASE}/files`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        kind: "drive#file",
        upload_type: "url",
        url: {
            url: magnetUrl
        }
      }),
    });

    if (!response.ok) {
        // Handle captcha verification error specifically if needed
        const err = await response.json();
        throw new Error(err.error_description || 'Failed to add magnet link');
    }

    return response.json();
  },

  async getTaskStatus(taskId: string, accessToken: string): Promise<any> {
      const response = await fetch(`${DRIVE_API_BASE}/tasks/${taskId}`, {
          method: 'GET',
          headers: {
              'Authorization': `Bearer ${accessToken}`,
          }
      });
      if(!response.ok) throw new Error("Failed to get task status");
      return response.json();
  },

  async getFile(fileId: string, accessToken: string): Promise<PikPakFile> {
    const response = await fetch(`${DRIVE_API_BASE}/files/${fileId}`, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${accessToken}`,
      },
    });

    if (!response.ok) {
      throw new Error('Failed to fetch file details');
    }

    return response.json();
  },

  // Helper to format bytes
  formatBytes(bytes: string | number, decimals = 2) {
    if (!bytes) return '0 Bytes';
    const k = 1024;
    const dm = decimals < 0 ? 0 : decimals;
    const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB', 'PB', 'EB', 'ZB', 'YB'];
    const i = Math.floor(Math.log(Number(bytes)) / Math.log(k));
    return parseFloat((Number(bytes) / Math.pow(k, i)).toFixed(dm)) + ' ' + sizes[i];
  }
};
