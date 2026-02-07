# MagnetPak Direct

A privacy-focused web interface for PikPak that allows you to add magnet links and get direct download links.

## Features

- **Direct Magnet to Download:** Input a magnet link, get a direct high-speed HTTP link.
- **Privacy:** Uses a shared account but filters the UI to show *only* the files you added in your current session.
- **Auto-Login:** Automatically connects using the configured node credentials. 
- **Captcha Support:** Handles security verifications seamlessly if triggered by the API.
- **Proxy:** Built-in Nginx reverse proxy to bypass CORS restrictions.
- **Dockerized:** Ready for VPS deployment.

## Deployment

### Prerequisites
- Docker & Docker Compose
- Git

### Quick Start (VPS)

1. Clone the repository:
```bash
git clone https://github.com/yourusername/magnetpak-direct.git
cd magnetpak-direct
```

2. Run the deployment command:
```bash
docker-compose up -d --build
```

3. Access the site at `http://YOUR_VPS_IP:3000`

### Credentials

The app is pre-configured to automatically log in with:
- **Email:** akilaramal@proton.me
- **Password:** Akila@7463

*Note: The login screen is hidden by default for a streamlined experience.*

### Technical Notes

- **CORS:** The `nginx.conf` handles proxying requests from `/api/*` to PikPak's servers.
- **Captcha:** If the account requires a captcha (Error Code 16), the app will display a modal asking you to solve it, then automatically retry the request.
- **Data Persistence:** "My Files" list is stored in the browser's `localStorage`.
