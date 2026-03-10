<!-- Copyright (c) 2025 VH & Co BV. Licensed under the Business Source License 1.1. See LICENSE for details. -->

# Testing the Non-Exposed API

This guide covers different ways to test your API when it's running locally or behind a tunnel.

## Quick Reference

- **Local API URL**: `http://localhost:8022`
- **Service Discovery**: `http://localhost:8022/.well-known/terraform.json`
- **Health Check**: `http://localhost:8022/health`
- **API Base**: `http://localhost:8022/api/v2`

---

## 1. Testing Locally (No Exposure)

### Basic Health Check

```bash
# Test if API is running
curl http://localhost:8022/health
```

### Test Service Discovery Endpoint

Authentication is not required for this endpoint.

```bash
curl http://localhost:8022/.well-known/terraform.json
```

### Test with Pretty Print

```bash
curl http://localhost:8022/.well-known/terraform.json | jq
```

---

## 2. Testing with Authentication

Most API endpoints require authentication. You'll need a Zitadel access token.

### Option A: Get Token from Browser (Easiest)

1. **Login via Frontend**:
   - Open `http://localhost:5173` in your browser
   - Login with your Zitadel credentials
   - Open browser DevTools (F12) → Application/Storage → Local Storage
   - Find the key containing your access token (usually `zitadel_access_token` or similar)

2. **Use Token in curl**:
   ```bash
   export TOKEN="your-access-token-here"
   
   curl -H "Authorization: Bearer $TOKEN" \
        http://localhost:8022/api/v2/organizations
   ```

### Option B: Get Token via Zitadel API

```bash
# Get access token using Zitadel OAuth2
# Replace CLIENT_ID, CLIENT_SECRET, USERNAME, PASSWORD with your values

curl -X POST http://localhost:8080/oauth/v2/token \
  -H "Content-Type: application/x-www-form-urlencoded" \
  -d "grant_type=password" \
  -d "client_id=YOUR_CLIENT_ID" \
  -d "client_secret=YOUR_CLIENT_SECRET" \
  -d "username=admin@ZITADEL.localhost" \
  -d "password=YOUR_PASSWORD" \
  -d "scope=openid profile email"

# Extract access_token from response
export TOKEN="<access_token_from_response>"
```

### Option C: Use TFE Token (for Terraform)

If you've created a TFE token:

```bash
export TFE_TOKEN="your-tfe-token-here"

curl -H "Authorization: Bearer $TFE_TOKEN" \
     http://localhost:8022/api/v2/organizations
```

---

## 3. Testing with ngrok (Expose to Internet)

Use ngrok to expose your local API for external testing (e.g., Terraform CLI, GitHub webhooks).

### Install ngrok

```bash
# Using the provided script
source <(curl -fsSL https://raw.githubusercontent.com/michielvha/PDS/main/bash/common/software/ngrok.sh)

# Or download from: https://ngrok.com/download
```

### Start ngrok Tunnel

```bash
# Expose API on port 8022
ngrok http 8022

# You'll see output like:
# Forwarding  https://abc123.ngrok-free.app -> http://localhost:8022
```

### Test via ngrok URL

```bash
# Get your ngrok URL from the ngrok output
export NGROK_URL="https://abc123.ngrok-free.app"

# Test service discovery
curl $NGROK_URL/.well-known/terraform.json

# Test health check
curl $NGROK_URL/health

# Test authenticated endpoint
curl -H "Authorization: Bearer $TOKEN" \
     $NGROK_URL/api/v2/organizations
```

### Use ngrok URL for Terraform

Update your `providers.tf` or `backend.tf`:

```hcl
terraform {
  backend "remote" {
    hostname = "abc123.ngrok-free.app"
    organization = "your-org-name"
    workspaces {
      name = "your-workspace"
    }
  }
}
```

---

## 4. Common Test Commands

### Service Discovery

```bash
# Test service discovery (public, no auth)
curl http://localhost:8022/.well-known/terraform.json | jq
```

### Organizations

```bash
# List organizations
curl -H "Authorization: Bearer $TOKEN" \
     http://localhost:8022/api/v2/organizations | jq

# Get specific organization
curl -H "Authorization: Bearer $TOKEN" \
     http://localhost:8022/api/v2/organizations/my-org | jq

# Create organization
curl -X POST \
     -H "Authorization: Bearer $TOKEN" \
     -H "Content-Type: application/json" \
     -d '{"name":"test-org","description":"Test Organization"}' \
     http://localhost:8022/api/v2/organizations | jq
```

### Workspaces

```bash
# List workspaces in organization
curl -H "Authorization: Bearer $TOKEN" \
     http://localhost:8022/api/v2/organizations/my-org/workspaces | jq

# Get workspace
curl -H "Authorization: Bearer $TOKEN" \
     http://localhost:8022/api/v2/organizations/my-org/workspaces/my-workspace | jq

# Create workspace
curl -X POST \
     -H "Authorization: Bearer $TOKEN" \
     -H "Content-Type: application/json" \
     -d '{
       "name":"test-workspace",
       "terraform_version":"1.5.0",
       "working_directory":"."
     }' \
     http://localhost:8022/api/v2/organizations/my-org/workspaces | jq
```

### Runs

```bash
# List runs for workspace
curl -H "Authorization: Bearer $TOKEN" \
     http://localhost:8022/api/v2/workspaces/WORKSPACE_ID/runs | jq

# Get run
curl -H "Authorization: Bearer $TOKEN" \
     http://localhost:8022/api/v2/runs/RUN_ID | jq

# Create run
curl -X POST \
     -H "Authorization: Bearer $TOKEN" \
     -H "Content-Type: application/json" \
     -d '{"workspace_id":"WORKSPACE_ID"}' \
     http://localhost:8022/api/v2/runs | jq
```

### State Versions

```bash
# List state versions
curl -H "Authorization: Bearer $TOKEN" \
     http://localhost:8022/api/v2/workspaces/WORKSPACE_ID/state-versions | jq

# Get state version
curl -H "Authorization: Bearer $TOKEN" \
     http://localhost:8022/api/v2/workspaces/WORKSPACE_ID/state-versions/STATE_VERSION_ID | jq
```

---

## 5. Testing with Terraform CLI

### Test Service Discovery

```bash
# Terraform will automatically check service discovery
terraform init

# Or manually test
curl https://your-ngrok-url.ngrok-free.app/.well-known/terraform.json
```

### Configure Terraform Backend

Create `backend.tf`:

```hcl
terraform {
  backend "remote" {
    hostname     = "your-ngrok-url.ngrok-free.app"
    organization = "your-org-name"
    workspaces {
      name = "your-workspace-name"
    }
  }
}
```

### Initialize Terraform

```bash
# Set TFE token
export TF_TOKEN_app_ngrok_free_app="your-tfe-token"

# Initialize
terraform init

# If using ngrok, you may need to accept the warning:
# terraform init -backend-config="skip_tls_verify=true"
```

---

## 6. Testing Script

Create a test script `test-api.sh`:

```bash
#!/bin/bash

API_URL="${API_URL:-http://localhost:8022}"
TOKEN="${TOKEN:-}"

echo "Testing API at: $API_URL"
echo ""

# Test health
echo "1. Health Check:"
curl -s "$API_URL/health" | jq
echo ""

# Test service discovery
echo "2. Service Discovery:"
curl -s "$API_URL/.well-known/terraform.json" | jq
echo ""

if [ -z "$TOKEN" ]; then
  echo "Skipping authenticated tests (set TOKEN env var)"
  exit 0
fi

# Test organizations
echo "3. Organizations:"
curl -s -H "Authorization: Bearer $TOKEN" \
     "$API_URL/api/v2/organizations" | jq
echo ""
```

Run it:

```bash
chmod +x test-api.sh

# Test locally
./test-api.sh

# Test with ngrok
API_URL="https://abc123.ngrok-free.app" ./test-api.sh

# Test with authentication
TOKEN="your-token" ./test-api.sh
```

---

## 7. Testing with Postman/Insomnia

### Import Collection

1. Create a new collection
2. Set base URL: `http://localhost:8022` (or your ngrok URL)
3. Add environment variable: `token` = your access token
4. Set collection-level header: `Authorization: Bearer {{token}}`

### Test Requests

1. **Health Check**: `GET /health`
2. **Service Discovery**: `GET /.well-known/terraform.json`
3. **List Organizations**: `GET /api/v2/organizations`
4. **Create Organization**: `POST /api/v2/organizations`

---

## 8. Troubleshooting

### API Not Responding

```bash
# Check if API is running
docker ps | grep api

# Check API logs
docker logs iac-api -f

# Check if port is in use
lsof -i :8022
```

### CORS Issues

If testing from browser console, ensure CORS is configured. The API allows:
- `http://localhost:5173` (frontend)
- `http://localhost:3000` (login UI)

### Authentication Errors

```bash
# Test token validity
curl -H "Authorization: Bearer $TOKEN" \
     http://localhost:8022/api/v2/organizations

# If 401, token may be expired - get a new one
# Check Zitadel token endpoint
curl http://localhost:8080/oauth/v2/keys
```

### ngrok Issues

```bash
# Check ngrok status
curl http://localhost:4040/api/tunnels

# ngrok web interface
open http://localhost:4040
```

---

## 9. Automated Testing

### Using the Test Script

```bash
cd backend
./test_registry.sh
```

### Environment Variables

```bash
export API_BASE_URL="http://localhost:8022/api/v2"
export TEST_DATABASE_URL="postgres://iac:iac_password@localhost:5432/iac_platform?sslmode=disable"
```

---

## 10. Quick Test Checklist

- [ ] Health endpoint responds: `curl http://localhost:8022/health`
- [ ] Service discovery works: `curl http://localhost:8022/.well-known/terraform.json`
- [ ] Service discovery includes `tfe.v2`: Check JSON response
- [ ] Can authenticate: Get token and test authenticated endpoint
- [ ] Organizations endpoint works: `GET /api/v2/organizations`
- [ ] ngrok tunnel works (if using): Test via ngrok URL
- [ ] Terraform can discover service: `terraform init` works

---

## Summary

**For Local Testing:**
- Use `http://localhost:8022`
- Get token from browser or Zitadel API
- Test with curl or Postman

**For External Testing (Terraform, Webhooks):**
- Use ngrok: `ngrok http 8022`
- Use ngrok HTTPS URL in configurations
- Test service discovery endpoint first

**For Automated Testing:**
- Use `backend/test_registry.sh`
- Set `API_BASE_URL` and `TEST_DATABASE_URL` environment variables

