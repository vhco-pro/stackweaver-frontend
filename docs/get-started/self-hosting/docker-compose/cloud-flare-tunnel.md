---
description: "Guide for exposing StackWeaver via Cloudflare Tunnel with systemd persistence"
covers: []
---

# Use Cloudflare tunnel to expose local service

Using a Cloudflare tunnel is a free, static alternative to using something like ngrok

**Key advantages:**
- **Static hostname** - you get a permanent subdomain that doesn't change
- **Completely free** - no limitations on the free tier for basic tunneling
- **GitHub webhook compatible** - reliable, static URL you can configure once

**Quick setup:**

1. Install cloudflared:
```bash
# macOS
brew install cloudflare/cloudflare/cloudflared

# Linux
wget https://github.com/cloudflare/cloudflared/releases/latest/download/cloudflared-linux-amd64.deb
sudo dpkg -i cloudflared-linux-amd64.deb
```

2. Authenticate:
```bash
cloudflared tunnel login
```

3. Create a tunnel (one-time):
```bash
cloudflared tunnel create my-github-webhook
```

4. Configure it - create `~/.cloudflared/config.yml`:
```yaml
tunnel: <tunnel-id-from-previous-command>
credentials-file: /home/your-user/.cloudflared/<tunnel-id>.json

ingress:
  - hostname: my-webhook.yourdomain.com  # or use a free .cfargotunnel.com domain
    service: http://localhost:8022
  - service: http_status:404
```

5. Route the tunnel:
```bash
cloudflared tunnel route dns my-github-webhook my-webhook.yourdomain.com
```

6. Run it:
```bash
cloudflared tunnel run my-github-webhook
```

**Even simpler - quick tunnel mode:**
If you just want to test first:
```bash
cloudflared tunnel --url http://localhost:8022
```

This gives you a temporary URL, but once you create a named tunnel as above, you get a permanent static hostname perfect for GitHub webhooks.

The static URL won't change, so you can configure it in GitHub once and forget about it.

Best ways to run cloudflared detached:

## Option 1: Systemd Service (Recommended, survives reboot)

The service runs as root and reads config from `/etc/cloudflared/`. Use a system-wide deploy so it starts on boot.

**1. Deploy config and credentials:**

```bash
# Create system config directory
sudo mkdir -p /etc/cloudflared

# Copy your config (adjust paths if yours differ)
sudo cp ~/.cloudflared/config.yml /etc/cloudflared/

# Copy the tunnel credentials JSON (replace <tunnel-id> with your tunnel UUID from `cloudflared tunnel list`)
sudo cp ~/.cloudflared/<tunnel-id>.json /etc/cloudflared/
```

**2. Point config at the system credentials path:**

Edit `/etc/cloudflared/config.yml` and set `credentials-file` to the path under `/etc/cloudflared/`:

```yaml
tunnel: my-github-webhook
credentials-file: /etc/cloudflared/<tunnel-id>.json

ingress:
  - hostname: my-webhook.yourdomain.com
    service: http://localhost:8022
  - service: http_status:404
```

Or do it in one go:

```bash
sudo sed -i 's|/home/your-user/.cloudflared/|/etc/cloudflared/|g' /etc/cloudflared/config.yml
```
(Replace `your-user` with your actual username.)

**3. Install and enable the systemd service:**

```bash
sudo cloudflared service install
```

This creates `cloudflared.service` and uses `/etc/cloudflared/config.yml`. Then:

```bash
# Enable on boot
sudo systemctl enable cloudflared

# Start now
sudo systemctl start cloudflared

# Check status
sudo systemctl status cloudflared
```

**4. Manage the service:**

```bash
# Start
sudo systemctl start cloudflared

# Stop
sudo systemctl stop cloudflared

# Restart
sudo systemctl restart cloudflared

# Status
sudo systemctl status cloudflared

# View logs
sudo journalctl -u cloudflared -f
```

Once this is done, the tunnel runs on boot and survives reboots.

## Adding another service (e.g. Zitadel at zitadel.vhco.pro)

If you already have a persisted tunnel and want to expose another local service (e.g. Zitadel on port 8080):

1. **Add an ingress rule** in your tunnel config (`~/.cloudflared/config.yml` or `/etc/cloudflared/config.yml`). Add a new line *before* the catch-all `service: http_status:404`:

   ```yaml
   ingress:
     - hostname: existing.example.com
       service: http://localhost:8022
     - hostname: zitadel.vhco.pro
       service: http://localhost:8080
     - service: http_status:404
   ```

2. **Route DNS** for the new hostname (use your existing tunnel name from `cloudflared tunnel list`):

   ```bash
   cloudflared tunnel route dns <your-tunnel-name> zitadel.vhco.pro
   ```

   This creates a CNAME record `zitadel.vhco.pro` → `<tunnel-id>.cfargotunnel.com` in Cloudflare (zone for vhco.pro must be on your Cloudflare account).

3. **Restart the tunnel** so it picks up the new config:

   - If running manually: stop and run `cloudflared tunnel run <your-tunnel-name>` again.
   - If using systemd: `sudo systemctl restart cloudflared`.

After that, https://zitadel.vhco.pro will proxy to http://localhost:8080.