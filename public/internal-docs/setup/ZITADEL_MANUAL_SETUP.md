<!-- Copyright (c) 2025 VH & Co BV. Licensed under the Business Source License 1.1. See LICENSE for details. -->

# Zitadel Manual Setup Guide

If the automated init script doesn't work, follow these manual steps to set up Zitadel.

## Prerequisites

1. Zitadel is running and accessible at `http://localhost:8080`
2. You can log in to the console with admin credentials

## Step 1: Verify Admin Account

1. Log in to: `http://localhost:8080/ui/console`
   - **Login:** `admin@ZITADEL.localhost`
   - **Password:** `Password1!`

2. Check if you can see "Instance" in the left sidebar
   - ✅ If you see "Instance", you have IAM_OWNER role - proceed to Step 2
   - ❌ If you DON'T see "Instance", your admin doesn't have IAM_OWNER role

### If Admin Doesn't Have IAM_OWNER Role

**This is NOT normal** - the first instance admin should automatically get IAM_OWNER.

**Option A: Recreate Zitadel (Recommended)**
```bash
# Stop Zitadel
docker-compose -f deploy/docker-compose.yml stop zitadel

# Drop and recreate the database
docker exec iac-postgres psql -U iac -d postgres -c "DROP DATABASE IF EXISTS zitadel;"
docker exec iac-postgres psql -U iac -d postgres -c "CREATE DATABASE zitadel;"

# Restart Zitadel (will recreate admin with IAM_OWNER)
docker-compose -f deploy/docker-compose.yml up -d zitadel
```

**Option B: Manually Assign IAM_OWNER (If you have another admin)**
- If you have another user with IAM_OWNER, they can assign it to your admin
- Go to: Instance → Members → Add admin@ZITADEL.localhost → Assign IAM_OWNER role

## Step 2: Create Service User

1. In the console, navigate to: **Instance → Service Users**
   - (If you don't see "Instance", you may need to check your admin permissions)

2. Click **"New"** or **"+"** to create a service user

3. Fill in:
   - **Name:** `init-script` (or any name you prefer)
   - **Description:** `For automated initialization`

4. Click **"Create"**

## Step 3: Add Service User as Instance Member

1. Go to: **Instance → Members**
   - ⚠️ **Important:** This must be at the **Instance** level, not Organization level

2. Click **"New"** or **"+"** to add a member

3. In the search box, find and select the service user you just created

4. In the **"Roles"** section:
   - Select **"IAM_OWNER"** role
   - (This gives full permissions to create orgs, projects, and apps)

5. Click **"Save"**

## Step 4: Generate Personal Access Token (PAT)

1. Go back to: **Instance → Service Users**

2. Click on the service user you created

3. Go to the **"Personal Access Tokens"** tab

4. Click **"New"** to generate a PAT

5. **⚠️ IMPORTANT:** Copy the PAT immediately - you'll only see it once!
   - The PAT will look like: `2uSH_HRVSGPxfqP2V7cL0nI-KIw2IKf1atdFVr4PSSb_HOqwbNWHjCKWzKDUS_LbxjW22q8`

## Step 5: Run the Init Script

1. Set the PAT as an environment variable:
   ```bash
   export ZITADEL_PAT='your-pat-here'
   ```

2. Run the init script:
   ```bash
   docker-compose -f deploy/docker-compose.yml up -d --build zitadel-init
   ```

3. Check the logs:
   ```bash
   docker logs iac-zitadel-init
   ```

## What the Script Does Automatically

Once you have a PAT with IAM_OWNER permissions, the script will:

1. ✅ Create organization: "IAC Platform"
2. ✅ Create project: "IAC Platform Project"  
3. ✅ Create **Frontend OIDC app** (React) - for user authentication
4. ✅ Create **Backend API app** - for service-to-service authentication
5. ✅ Write config files:
   - `frontend/.env` - Frontend client ID
   - `.env` - Root config with both client IDs
   - `backend/config/config.docker.yaml` - Backend client ID and secret

## Troubleshooting

### "I don't see 'Instance' in the sidebar"

- Your admin user may not have IAM_OWNER role
- Check: Go to your profile → check your roles
- You may need to recreate Zitadel with a fresh database

### "I don't see any roles to assign"

- Make sure you're at **Instance → Members**, not Organization → Members
- The IAM_OWNER role should be available at the instance level
- If roles are empty, your admin may not have permission to assign roles

### "Service user creation fails"

- Make sure you're logged in as an admin with IAM_OWNER role
- Check that you're at Instance level, not Organization level

### "PAT doesn't work - permission errors"

- Verify the service user is added as Instance Member with IAM_OWNER role
- Generate a new PAT and try again
- Check the init script logs for specific error messages

