import { PikPakLoginResponse, PikPakFile, PikPakTask, CaptchaInitResponse, CaptchaVerifyResponse } from '../types';

// NOTE: When running locally without the Nginx proxy, you might hit CORS errors.
// The Docker setup provided in the solution includes an Nginx reverse proxy to handle this.
// API_BASE is set to a relative path assuming the Nginx proxy is serving /api/pikpak -> https://api-drive.mypikpak.com
// and /api/auth -> https://user.mypikpak.com

const AUTH_API_BASE = '/api/auth/v1';
const DRIVE_API_BASE = '/api/drive/v1';
const CLIENT_ID = "YNxT9w7GMvwDryEF"; // Common Web Client ID

export class VerificationError extends Error {
  public data: any;
  constructor(data: any) {
    super(data.error_description || 'Verification required');
    this.name = 'VerificationError';
    this.data = data;
  }
}

export const PikPakService = {
  
  async login(username: string, password: string, captchaToken?: string): Promise<PikPakLoginResponse> {
    const body: any = {
      username,
      password,
      client_id: CLIENT_ID,
    };

    if (captchaToken) {
      body.captcha_token = captchaToken;
    }

    const response = await fetch(`${AUTH_API_BASE}/auth/signin`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(body),
    });

    if (!response.ok) {
      const err = await response.json();
      // Check for captcha/verification error codes
      // 16: Verification code required (generic)
      // 400 with verification_required
      if (err.error_code === 16 || err.error === 'verification_required') {
         throw new VerificationError(err);
      }
      throw new Error(err.error_description || 'Login failed');
    }

    return response.json();
  },

  async addMagnet(magnetUrl: string, accessToken: string, captchaToken?: string): Promise<PikPakTask> {
    const headers: any = {
      'Authorization': `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
    };

    if (captchaToken) {
       headers['X-Captcha-Token'] = captchaToken;
    }

    const response = await fetch(`${DRIVE_API_BASE}/files`, {
      method: 'POST',
      headers,
      body: JSON.stringify({
        kind: "drive#file",
        upload_type: "url",
        url: {
            url: magnetUrl
        }
      }),
    });

    if (!response.ok) {
        const err = await response.json();
        if (err.error_code === 16 || err.error === 'verification_required') {
            throw new VerificationError(err);
        }
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

  // --- Captcha Methods ---

  async initCaptcha(): Promise<CaptchaInitResponse> {
      const response = await fetch(`${AUTH_API_BASE}/shield/captcha/init`, {
          method: 'POST',
          headers: {
              'Content-Type': 'application/json'
          },
          body: JSON.stringify({
              client_id: CLIENT_ID,
              action: 'POST:/v1/auth/signin' // Context usually helps
          })
      });

      if (!response.ok) {
          throw new Error("Failed to initialize captcha");
      }
      return response.json();
  },

  async verifyCaptcha(code: string, sign: string): Promise<CaptchaVerifyResponse> {
      const response = await fetch(`${AUTH_API_BASE}/shield/captcha/verify`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({
              client_id: CLIENT_ID,
              code: code,
              captcha_token: sign // The token from init is passed here
          })
      });

      if (!response.ok) {
          const err = await response.json();
          throw new Error(err.error_description || "Captcha verification failed");
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
