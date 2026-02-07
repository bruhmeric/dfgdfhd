# MagnetPak Direct

A privacy-focused web interface for PikPak that allows you to add magnet links and get direct download links.

## Features

- **Direct Magnet to Download:** Input a magnet link, get a direct high-speed HTTP link.
- **Privacy:** Uses a shared account but filters the UI to show *only* the files you added in your current session.
- **Proxy:** Built-in Nginx reverse proxy to bypass CORS restrictions on the PikPak API.
- **Dockerized:** Ready for VPS deployment.

## Deployment

### Prerequisites
- Docker & Docker Compose

### Quick Start (VPS)

1. Create a folder and place all the provided files inside it.
2. Run the deployment command:

```bash
docker-compose up -d --build
```

3. Access the site at `http://YOUR_VPS_IP:3000`

### Credentials

The app is pre-configured with the requested credentials, but fields are editable on the login screen.

**Default Login:**
- **Email:** akilaramal@proton.me
- **Password:** Akila@7463

### Technical Notes

- **CORS:** The `nginx.conf` handles proxying requests from `/api/*` to PikPak's servers (`user.mypikpak.com` and `api-drive.mypikpak.com`). This ensures the browser can communicate with the API without CORS errors.
- **Captcha:** If the account requires a captcha, the API call will fail with an error message in the UI. For automated captcha solving, you would need to integrate a third-party solver service into the backend proxy, which is outside the scope of this pure React+Nginx setup.
- **Data Persistence:** "My Files" list is stored in the browser's `localStorage`. Clearing cache will hide your history (though files remain on the PikPak account).
