<!-- Copyright (c) 2025 VH & Co BV. Licensed under the Business Source License 1.1. See LICENSE for details. -->

# Syntax Highlighting Test Page

This page contains various code examples to test syntax highlighting with different languages and themes.

## Callout Box Examples

All callout types supported by the documentation viewer:

> [!NOTE]
> This is a **note** callout box. Use it for general information or reminders. You can include `inline code` and **bold text** within callouts.

> [!TIP] This callout has a title
> Tips and tricks should go here. This callout demonstrates a title on the same line as the marker. The title will appear at the top of the callout box.

> [!IMPORTANT]
> Important information that users must be aware of. This should be used sparingly for critical information that affects functionality or security.

> [!WARNING]
> This is a warning callout. Use it to alert users about potential issues, deprecated features, or important caveats. For example: "This API endpoint will be removed in v3.0."

> [!CAUTION]
> Use caution callouts for dangerous operations or actions that could cause data loss or system instability. Always read warnings carefully before proceeding.

> [!NOTE] Custom title here
> This note has a custom title that appears on the same line as `[!NOTE]`. The body content goes here with support for **markdown formatting** and `inline code blocks`.

> [!TIP]
> Callouts can contain:
> - **Bold text** for emphasis
> - `Inline code` for technical terms
> - Regular paragraphs with multiple sentences.
> - Even `code blocks with **nested** formatting` (though less common).

## Code Group Example

The code blocks below should render as a single **tabbed code group**:

::: code-group
```bash [Bash]
echo "hello from bash"
echo "current directory: $(pwd)"
if [ pwd -f blabla]
  export $string="this is an example"
fi  
```
```yaml [Kubernetes]
apiVersion: v1
kind: ConfigMap
metadata:
  name: stackweaver-docs-example
data:
  message: "hello from yaml"
```
:::

## JSON Example

```json
{
  "name": "stackweaver",
  "version": "1.0.0",
  "description": "IaC Orchestration Platform",
  "keywords": ["terraform", "ansible", "devops"],
  "config": {
    "api_version": "v2",
    "port": 8080,
    "debug": false,
    "features": ["runs", "workspaces", "variables"]
  },
  "dependencies": {
    "react": "^18.2.0",
    "typescript": "^5.0.0"
  }
}
```

## YAML Example

```yaml
apiVersion: apps/v1
kind: Deployment
metadata:
  name: stackweaver-api
  labels:
    app: stackweaver
    tier: backend
spec:
  replicas: 3
  selector:
    matchLabels:
      app: stackweaver
  template:
    metadata:
      labels:
        app: stackweaver
    spec:
      containers:
      - name: api
        image: stackweaver/api:latest
        ports:
        - containerPort: 8080
        env:
        - name: DATABASE_URL
          value: "postgresql://localhost:5432/stackweaver"
        - name: LOG_LEVEL
          value: "info"
        resources:
          requests:
            memory: "512Mi"
            cpu: "500m"
          limits:
            memory: "1Gi"
            cpu: "1000m"
```

## TypeScript Example

```typescript
interface WorkspaceConfig {
  name: string;
  terraformVersion: string;
  variables: Record<string, string | number | boolean>;
  workingDirectory?: string;
}

class WorkspaceService {
  private apiClient: ApiClient;

  constructor(apiClient: ApiClient) {
    this.apiClient = apiClient;
  }

  async createWorkspace(config: WorkspaceConfig): Promise<Workspace> {
    const response = await this.apiClient.post('/workspaces', {
      data: {
        type: 'workspaces',
        attributes: {
          name: config.name,
          'terraform-version': config.terraformVersion,
          'working-directory': config.workingDirectory || '',
        },
      },
    });

    return this.mapResponseToWorkspace(response.data);
  }

  private mapResponseToWorkspace(data: any): Workspace {
    return {
      id: data.id,
      name: data.attributes.name,
      terraformVersion: data.attributes['terraform-version'],
      createdAt: new Date(data.attributes['created-at']),
    };
  }
}
```

## Python Example

```python
import asyncio
from typing import List, Optional
from dataclasses import dataclass

@dataclass
class RunStatus:
    id: str
    status: str
    created_at: str
    updated_at: Optional[str] = None

class TerraformRunner:
    def __init__(self, workspace_id: str, config: dict):
        self.workspace_id = workspace_id
        self.config = config
        self.status = RunStatus(id="", status="pending", created_at="")
    
    async def plan(self) -> dict:
        """Run terraform plan and return output"""
        command = ["terraform", "plan", "-out=tfplan"]
        result = await self._execute_command(command)
        return {
            "resource_changes": result.get("resource_changes", []),
            "planned_values": result.get("planned_values", {}),
        }
    
    async def apply(self) -> dict:
        """Apply terraform plan"""
        command = ["terraform", "apply", "tfplan"]
        return await self._execute_command(command)
    
    async def _execute_command(self, command: List[str]) -> dict:
        """Execute terraform command and parse output"""
        # Implementation here
        pass
```

## Go Example

```go
package handlers

import (
    "context"
    "encoding/json"
    "net/http"
    "time"
)

type WorkspaceHandler struct {
    service WorkspaceService
    logger  Logger
}

type CreateWorkspaceRequest struct {
    Data struct {
        Type       string `json:"type"`
        Attributes struct {
            Name             string `json:"name"`
            TerraformVersion string `json:"terraform-version"`
        } `json:"attributes"`
    } `json:"data"`
}

func (h *WorkspaceHandler) CreateWorkspace(w http.ResponseWriter, r *http.Request) {
    var req CreateWorkspaceRequest
    if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
        h.respondError(w, http.StatusBadRequest, err)
        return
    }

    ctx, cancel := context.WithTimeout(r.Context(), 30*time.Second)
    defer cancel()

    workspace, err := h.service.CreateWorkspace(ctx, req.Data.Attributes)
    if err != nil {
        h.respondError(w, http.StatusInternalServerError, err)
        return
    }

    h.respondJSON(w, http.StatusCreated, workspace)
}

func (h *WorkspaceHandler) respondJSON(w http.ResponseWriter, status int, data interface{}) {
    w.Header().Set("Content-Type", "application/vnd.api+json")
    w.WriteHeader(status)
    json.NewEncoder(w).Encode(data)
}
```

## Shell/Bash Example

```bash
#!/bin/bash
set -euo pipefail

# Configuration
WORKSPACE_NAME="production-infra"
TERRAFORM_VERSION="1.5.0"
STATE_BACKEND="s3://stackweaver-state"

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

log_info() {
    echo -e "${GREEN}[INFO]${NC} $1"
}

log_warn() {
    echo -e "${YELLOW}[WARN]${NC} $1"
}

log_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

# Initialize terraform
init_terraform() {
    log_info "Initializing Terraform..."
    terraform init \
        -backend-config="bucket=${STATE_BACKEND}" \
        -upgrade || {
        log_error "Failed to initialize Terraform"
        exit 1
    }
}

# Run plan
run_plan() {
    log_info "Running Terraform plan..."
    terraform plan -out=tfplan || {
        log_error "Plan failed"
        exit 1
    }
}

# Main execution
main() {
    init_terraform
    run_plan
    log_info "Terraform plan completed successfully"
}

main "$@"
```

## Plain Text / Default Code Block

```
This is a plain code block with no language specified.
It should still have:
- A colored border
- Good readability
- Proper formatting

Even without syntax highlighting, it should look nice!
```

## Mixed Example (JSON with Comments)

```jsonc
{
  // This is a JSON with comments example
  "name": "stackweaver",
  "version": "1.0.0",
  "config": {
    "api_version": "v2",
    "port": 8080,
    "debug": false
    // Debug should be false in production
  }
}
```

## HCL/Terraform Example

```hcl
terraform {
  required_version = ">= 1.5.0"
  
  required_providers {
    aws = {
      source  = "hashicorp/aws"
      version = "~> 5.0"
    }
  }
  
  backend "s3" {
    bucket         = "stackweaver-terraform-state"
    key            = "production/terraform.tfstate"
    region         = "us-east-1"
    encrypt        = true
    dynamodb_table = "terraform-locks"
  }
}

resource "aws_instance" "web_server" {
  ami           = var.ami_id
  instance_type = var.instance_type
  
  tags = {
    Name        = "web-server"
    Environment = var.environment
    ManagedBy   = "stackweaver"
  }
  
  user_data = <<-EOF
    #!/bin/bash
    apt-get update
    apt-get install -y nginx
    systemctl enable nginx
    systemctl start nginx
  EOF
}

variable "ami_id" {
  description = "AMI ID for the EC2 instance"
  type        = string
}

variable "instance_type" {
  description = "EC2 instance type"
  type        = string
  default     = "t3.medium"
}

variable "environment" {
  description = "Environment name"
  type        = string
  validation {
    condition     = contains(["dev", "staging", "production"], var.environment)
    error_message = "Environment must be dev, staging, or production."
  }
}
```
