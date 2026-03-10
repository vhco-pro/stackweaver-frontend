<!-- Copyright (c) 2025 VH & Co BV. Licensed under the Business Source License 1.1. See LICENSE for details. -->

# Ansible Runner Overview

## Overview

The Ansible Runner is a dedicated service that executes Ansible playbooks in isolated environments. It listens to a Redis queue for job requests and processes them sequentially, capturing all output and events.

## Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                        Ansible Runner                            │
├─────────────────────────────────────────────────────────────────┤
│  ┌──────────────┐    ┌──────────────┐    ┌──────────────────┐  │
│  │ Queue Listener│───▶│ Job Processor │───▶│ Ansible Executor │  │
│  │  (Redis)      │    │              │    │  (subprocess)    │  │
│  └──────────────┘    └──────────────┘    └──────────────────┘  │
│                              │                    │              │
│                              │                    ▼              │
│                              │           ┌──────────────────┐   │
│                              │           │ Event Parser     │   │
│                              │           │ (JSONL callback) │   │
│                              │           └──────────────────┘   │
│                              ▼                    │              │
│                     ┌──────────────────┐         │              │
│                     │  Result Handler  │◀────────┘              │
│                     │ - Update job     │                        │
│                     │ - Store events   │                        │
│                     │ - Cleanup        │                        │
│                     └──────────────────┘                        │
└─────────────────────────────────────────────────────────────────┘
```

## Job Execution Flow

### 1. Job Pickup

```go
func (r *Runner) processJobs() {
    for {
        // Block until job available
        result, err := r.redisClient.BLPop(ctx, 0, "ansible:jobs").Result()
        if err != nil {
            continue
        }
        
        var jobRequest JobRequest
        json.Unmarshal([]byte(result[1]), &jobRequest)
        
        r.executeJob(jobRequest)
    }
}
```

### 2. Environment Setup

Before execution, the runner:

1. **Creates temp directory** for job artifacts
2. **Writes inventory file** (INI format with host variables)
3. **Writes credentials** (SSH key, vault password)
4. **Clones playbook repository** from VCS
5. **Sets environment variables** for Ansible

### 3. Command Construction

```go
func (r *Runner) buildCommand(job *JobRequest) *exec.Cmd {
    args := []string{
        job.PlaybookPath,
        "-i", inventoryPath,
    }
    
    // Add optional parameters
    if job.Limit != "" {
        args = append(args, "--limit", job.Limit)
    }
    if job.Tags != "" {
        args = append(args, "--tags", job.Tags)
    }
    if job.SkipTags != "" {
        args = append(args, "--skip-tags", job.SkipTags)
    }
    if job.Verbosity > 0 {
        args = append(args, "-"+strings.Repeat("v", job.Verbosity))
    }
    if job.BecomeEnabled {
        args = append(args, "--become")
    }
    if job.DiffMode {
        args = append(args, "--diff")
    }
    if job.CheckMode {
        args = append(args, "--check")
    }
    if job.Forks > 0 {
        args = append(args, "--forks", strconv.Itoa(job.Forks))
    }
    
    cmd := exec.Command("ansible-playbook", args...)
    cmd.Dir = workDir
    cmd.Env = r.buildEnvironment(job)
    
    return cmd
}
```

### 4. Environment Variables

```go
func (r *Runner) buildEnvironment(job *JobRequest) []string {
    env := os.Environ()
    env = append(env,
        // Output callback for JSON event streaming
        "ANSIBLE_STDOUT_CALLBACK=ansible.posix.jsonl",
        
        // Disable host key checking for automation
        "ANSIBLE_HOST_KEY_CHECKING=false",
        
        // Force color output
        "ANSIBLE_FORCE_COLOR=true",
        
        // Set SSH key if provided
        fmt.Sprintf("ANSIBLE_PRIVATE_KEY_FILE=%s", sshKeyPath),
        
        // Vault password file if provided
        fmt.Sprintf("ANSIBLE_VAULT_PASSWORD_FILE=%s", vaultPasswordPath),
    )
    return env
}
```

## Inventory Generation

The runner generates INI-format inventory files:

```go
func generateInventory(inventory *AnsibleInventory) string {
    var buf bytes.Buffer
    
    // Write ungrouped hosts
    for _, host := range inventory.Hosts {
        if len(host.Groups) == 0 {
            buf.WriteString(formatHost(host))
        }
    }
    
    // Write groups and their hosts
    for _, group := range inventory.Groups {
        buf.WriteString(fmt.Sprintf("\n[%s]\n", group.Name))
        for _, host := range group.Hosts {
            buf.WriteString(formatHost(host))
        }
        
        // Write group variables
        if len(group.Variables) > 0 {
            buf.WriteString(fmt.Sprintf("\n[%s:vars]\n", group.Name))
            for k, v := range group.Variables {
                buf.WriteString(fmt.Sprintf("%s=%v\n", k, v))
            }
        }
    }
    
    return buf.String()
}

func formatHost(host *InventoryHost) string {
    line := host.Name
    if host.Hostname != "" && host.Hostname != host.Name {
        line += fmt.Sprintf(" ansible_host=%s", host.Hostname)
    }
    if host.Port != 22 {
        line += fmt.Sprintf(" ansible_port=%d", host.Port)
    }
    for k, v := range host.Variables {
        line += fmt.Sprintf(" %s=%v", k, v)
    }
    return line + "\n"
}
```

**Example Generated Inventory:**

```ini
[webservers]
web1 ansible_host=192.168.1.10 ansible_user=ubuntu
web2 ansible_host=192.168.1.11 ansible_user=ubuntu

[webservers:vars]
http_port=80
max_clients=200

[databases]
db1 ansible_host=192.168.1.20 ansible_user=postgres

[all:children]
webservers
databases
```

## Credential Handling

### SSH Keys

```go
func (r *Runner) writeSSHKey(credential *Credential, tempDir string) (string, error) {
    // Decrypt the key
    decryptedKey, err := crypto.Decrypt(credential.SSHPrivateKey)
    if err != nil {
        return "", err
    }
    
    // Write to temp file with proper permissions
    keyPath := filepath.Join(tempDir, "ssh_key")
    if err := os.WriteFile(keyPath, decryptedKey, 0600); err != nil {
        return "", err
    }
    
    return keyPath, nil
}
```

### Vault Password

```go
func (r *Runner) writeVaultPassword(credential *Credential, tempDir string) (string, error) {
    decryptedPassword, err := crypto.Decrypt(credential.VaultPassword)
    if err != nil {
        return "", err
    }
    
    vaultPath := filepath.Join(tempDir, "vault_password")
    if err := os.WriteFile(vaultPath, decryptedPassword, 0600); err != nil {
        return "", err
    }
    
    return vaultPath, nil
}
```

## Container Runtime

The runner uses a three-stage Docker build defined in `runner-images/ansible/Dockerfile`. The build context must be the repository root.

**Stage 1 — Go builder:** Compiles the `ansible-runner` binary from `backend/cmd/ansible-runner`.

**Stage 2 — Python deps:** Installs all Python packages into an isolated virtualenv at `/opt/ansible-deps/.venv` using [uv](https://github.com/astral-sh/uv) from the lockfile (`runner-images/ansible/uv.lock`). This stage is discarded; only the `.venv` is copied forward.

**Stage 3 — Runtime:** `python:3.14-slim` with the pre-built venv, system packages (`openssh-client`, `git`, `sshpass`), the Go binary, and the OIDC inventory wrapper. Runs as non-root user `iac` (UID 1001).

Python dependencies are declared in `runner-images/ansible/pyproject.toml` using PEP 621 dependency groups:

| Group | Packages |
|-------|---------|
| core (always) | ansible, ansible-lint, jmespath, netaddr |
| `aws` | boto3, botocore |
| `azure` | azure-identity, azure-mgmt-\*, azure-cli-core |
| `gcp` | google-auth |
| `vmware` | pyvmomi |
| `all` | all of the above (used in the official image) |

Ansible Galaxy collections are pinned in `runner-images/ansible/requirements.yml`.

## Error Handling

```go
func (r *Runner) executeJob(job *JobRequest) {
    // Update status to running
    r.updateJobStatus(job.ID, "running", nil)
    
    defer func() {
        if err := recover(); err != nil {
            r.updateJobStatus(job.ID, "failed", fmt.Errorf("panic: %v", err))
        }
        r.cleanup(job.TempDir)
    }()
    
    // Execute and handle errors
    if err := r.runAnsible(job); err != nil {
        var exitErr *exec.ExitError
        if errors.As(err, &exitErr) {
            // Ansible non-zero exit - job failed
            r.updateJobStatus(job.ID, "failed", nil)
        } else {
            // System error - execution error
            r.updateJobStatus(job.ID, "failed", err)
        }
        return
    }
    
    r.updateJobStatus(job.ID, "successful", nil)
}
```

## Cleanup

After each job:

```go
func (r *Runner) cleanup(tempDir string) {
    // Remove temp directory with all credentials and artifacts
    if err := os.RemoveAll(tempDir); err != nil {
        log.Printf("Failed to cleanup temp dir: %v", err)
    }
}
```

## Resource Limits

Container resource constraints:

```yaml
services:
  ansible-runner:
    deploy:
      resources:
        limits:
          cpus: '2.0'
          memory: 2G
        reservations:
          cpus: '0.5'
          memory: 512M
```

## Concurrency

Currently single-threaded for simplicity. Future considerations:

1. **Worker Pool**: Multiple goroutines processing jobs
2. **Job Prioritization**: High/normal/low priority queues
3. **Resource Isolation**: Separate containers per job
4. **Rate Limiting**: Max concurrent jobs per organization

## Logging

```go
func (r *Runner) log(job *JobRequest, level, message string, args ...interface{}) {
    log.Printf("[%s] [job:%s] "+message, append([]interface{}{level, job.ID}, args...)...)
}
```
