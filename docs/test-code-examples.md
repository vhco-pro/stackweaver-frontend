---
description: "Test page for file tree, file inclusion, and code explorer features."
status: "in-progress"
status_description: "Testing all docs framework features"
author: "Michiel VH"
priority: "high"
created: "2026-03-08"
updated: "2026-03-11"
issue: "https://github.com/stackweaver/stackweaver/issues/1"
---

# Code Examples Test

This page exercises all code-example features added in the docs-code-examples plan.

---

## Feature 1: File Tree

A static directory structure diagram rendered from `tree`-language fenced code blocks.

```tree
entra-setup/
├── main.tf
├── variables.tf
└── outputs.tf
```

Nested example:

```tree
stackweaver/
├── backend/
│   ├── cmd/
│   │   ├── api/
│   │   └── runner/
│   └── internal/
│       ├── models/
│       └── services/
├── frontend/
│   └── src/
│       ├── components/
│       └── pages/
└── deploy/
    ├── docker-compose.yml
    └── .env.example
```

---

## Feature 2: File Inclusion

The line below is a `<<< ./path` directive. The build script replaces it with the file contents as a fenced code block.

<<< ./user-guides/vcs/entra-setup/variables.tf

Line-range example (first 28 lines of main.tf: the header and terraform block):

<<< ./user-guides/vcs/entra-setup/main.tf#L1-L28

---

## Feature 3: Code Explorer

An interactive file browser for the `entra-setup` Terraform module. Click a file in the left panel to view it.

::: code-explorer ./user-guides/vcs/entra-setup
:::

With a default file pre-selected:

::: code-explorer ./user-guides/vcs/entra-setup default="outputs.tf"
:::

---

## Phase 4: Language Icons, Download, Fullscreen, GitHub Sources

### Feature 4: Language-Specific File Icons

The code explorer and file tree viewer now show per-language icons. Open any code explorer below and
inspect the file list to confirm `.tf` files show the Terraform diamond, `.go` files the Go gopher,
`.ts` files the TypeScript blue square, etc.

### Feature 5: ZIP Download

Each code explorer now has a **Download** button in the header. Clicking it packages all files in
the explorer into a `.zip` archive and triggers a browser download.

### Feature 7: Expand / Fullscreen Mode

Each code explorer has a **⤢** (Maximize2) button in the header. Clicking it opens the explorer in
a full-screen overlay (90vw × 90vh) for easier navigation of large file trees and long files.

---

## Phase 6: GitHub Code Snippets + Explorer Enhancements

### Feature: Code Snippet (`::: code-snippet`)

Embeds a specific file and line range from a GitHub repo as a compact card with attribution and a link back.

Single file snippet with line range (HashiCorp Terraform AWS VPC module, main outputs):

::: code-snippet https://github.com/hashicorp/terraform-aws-vpc/blob/master/outputs.tf#L1-L19
:::

Full file snippet (no line range):

::: code-snippet https://github.com/hashicorp/terraform-aws-vpc/blob/master/variables.tf#L1-L15
:::

### Feature: Code Explorer from GitHub (subdirectory)

Browse a real GitHub directory interactively. This fetches the HashiCorp Terraform AWS VPC examples at build time:

::: code-explorer github:hashicorp/terraform-aws-vpc/examples/simple-vpc@master
:::

### Feature: Explorer GitHub UX Enhancements

The GitHub-sourced explorers above should show:
- **Ref in header**: e.g. `SIMPLE @ main` with the ref after the directory name
- **Per-file GitHub links**: the ↗ button updates to link to the currently selected file on GitHub (not just the directory)

---

## Code Groups

Tabbed code blocks using the `::: code-group` directive. Each tab can have a custom label in square brackets after the language. Icons are shown for recognised languages.

### Shell & Infrastructure

Bash, Go, Kubernetes, Docker Compose, and PowerShell:

::: code-group
```bash [Bash]
#!/bin/bash
echo "Hello from Bash"
curl -s https://api.example.com/health | jq .
```
```go [Go]
package main

import "fmt"

func main() {
    fmt.Println("Hello from Go")
}
```
:::

::: code-group
```yaml [Kubernetes]
apiVersion: apps/v1
kind: Deployment
metadata:
  name: stackweaver-api
  labels:
    app: stackweaver
spec:
  replicas: 3
```
```yaml [Docker Compose]
services:
  api:
    image: stackweaver/api:latest
    ports:
      - "8022:8022"
    environment:
      - DATABASE_URL=postgres://localhost/stackweaver
```
```powershell [PowerShell]
$response = Invoke-RestMethod -Uri "https://api.example.com/health"
Write-Host "Status: $($response.status)"
```
:::

### Application Languages

::: code-group
```python [Python]
import requests

response = requests.get("https://api.example.com/health")
print(f"Status: {response.json()['status']}")
```
```typescript [TypeScript]
const response = await fetch("https://api.example.com/health");
const data: HealthCheck = await response.json();
console.log(`Status: ${data.status}`);
```
```javascript [JavaScript]
const res = await fetch("https://api.example.com/health");
const data = await res.json();
console.log("Status:", data.status);
```
:::

::: code-group
```hcl [Terraform]
resource "aws_instance" "web" {
  ami           = "ami-0c55b159cbfafe1f0"
  instance_type = "t3.micro"

  tags = {
    Name = "stackweaver-web"
  }
}
```
```yaml [YAML]
apiVersion: v1
kind: ConfigMap
metadata:
  name: app-config
data:
  DATABASE_HOST: "postgres.default.svc"
  REDIS_HOST: "redis.default.svc"
```
```json [JSON]
{
  "name": "stackweaver",
  "version": "1.0.0",
  "dependencies": {
    "react": "^19.0.0",
    "vite": "^6.0.0"
  }
}
```
:::

### Web & Data

::: code-group
```css [CSS]
.code-group-tab {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  padding: 0.375rem 0.75rem;
  border-radius: 0.375rem;
}
```
```html [HTML]
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <title>Stackweaver</title>
</head>
<body>
  <div id="root"></div>
</body>
</html>
```
```sql [SQL]
SELECT w.name, w.status, COUNT(r.id) as run_count
FROM workspaces w
LEFT JOIN runs r ON r.workspace_id = w.id
WHERE w.organization_id = $1
GROUP BY w.id
ORDER BY run_count DESC;
```
:::

::: code-group
```rust [Rust]
use reqwest;

#[tokio::main]
async fn main() -> Result<(), Box<dyn std::error::Error>> {
    let resp = reqwest::get("https://api.example.com/health").await?;
    println!("Status: {}", resp.status());
    Ok(())
}
```
```java [Java]
import java.net.http.*;

public class HealthCheck {
    public static void main(String[] args) throws Exception {
        var client = HttpClient.newHttpClient();
        var request = HttpRequest.newBuilder()
            .uri(URI.create("https://api.example.com/health"))
            .build();
        var response = client.send(request, HttpResponse.BodyHandlers.ofString());
        System.out.println("Status: " + response.statusCode());
    }
}
```
:::

### Single Code Block (no tabs)

A code group with only one block should render without tabs:

::: code-group
```bash [Install]
curl -fsSL https://get.stackweaver.dev | bash
```
:::
