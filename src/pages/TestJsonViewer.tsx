// Copyright (c) 2025 VH & Co BV. Licensed under the Business Source License 1.1. See LICENSE for details.

import { JsonViewer } from '@/components/runs/JsonViewer';
import { OutputViewer } from '@/components/runs/OutputViewer';
import { Button } from '@/components/ui/button';
import { ArrowLeft } from 'lucide-react';
import { Link } from 'react-router-dom';

// Mock Terraform plan output data
const mockPlanOutput = {
  format_version: "1.0",
  terraform_version: "1.5.0",
  planned_values: {
    root_module: {
      resources: [
        {
          address: "aws_instance.example",
          mode: "managed",
          type: "aws_instance",
          name: "example",
          provider_name: "registry.terraform.io/hashicorp/aws",
          schema_version: 1,
          values: {
            ami: "ami-0c55b159cbfafe1f0",
            instance_type: "t2.micro",
            tags: {
              Name: "Example Instance",
              Environment: "production"
            }
          },
          sensitive_values: {}
        },
        {
          address: "aws_s3_bucket.data",
          mode: "managed",
          type: "aws_s3_bucket",
          name: "data",
          provider_name: "registry.terraform.io/hashicorp/aws",
          schema_version: 0,
          values: {
            bucket: "my-data-bucket",
            force_destroy: false
          },
          sensitive_values: {}
        }
      ],
      child_modules: []
    }
  },
  resource_changes: [
    {
      address: "aws_instance.example",
      mode: "managed",
      type: "aws_instance",
      name: "example",
      provider_name: "registry.terraform.io/hashicorp/aws",
      change: {
        actions: ["create"],
        before: null,
        after: {
          ami: "ami-0c55b159cbfafe1f0",
          instance_type: "t2.micro",
          tags: {
            Name: "Example Instance",
            Environment: "production"
          }
        },
        after_unknown: {
          arn: true,
          id: true,
          instance_state: true
        },
        before_sensitive: false,
        after_sensitive: {}
      }
    },
    {
      address: "aws_s3_bucket.data",
      mode: "managed",
      type: "aws_s3_bucket",
      name: "data",
      provider_name: "registry.terraform.io/hashicorp/aws",
      change: {
        actions: ["create"],
        before: null,
        after: {
          bucket: "my-data-bucket",
          force_destroy: false
        },
        after_unknown: {},
        before_sensitive: false,
        after_sensitive: {}
      }
    }
  ],
  configuration: {
    provider_config: {
      aws: {
        name: "aws",
        full_name: "registry.terraform.io/hashicorp/aws",
        version_constraint: "~> 5.0"
      }
    },
    root_module: {
      resources: [
        {
          address: "aws_instance.example",
          mode: "managed",
          type: "aws_instance",
          name: "example",
          provider_config_key: "aws",
          expressions: {
            ami: {
              constant_value: "ami-0c55b159cbfafe1f0"
            },
            instance_type: {
              constant_value: "t2.micro"
            }
          }
        }
      ]
    }
  },
  outputs: {
    instance_id: {
      value: "${aws_instance.example.id}",
      type: "string",
      sensitive: false
    },
    bucket_name: {
      value: "${aws_s3_bucket.data.id}",
      type: "string",
      sensitive: false
    }
  },
  checks: [],
  timestamp: "2024-01-15T10:30:00Z"
};

// Simpler mock data for testing
const simpleMockData = {
  message: "Plan completed successfully",
  resources_to_add: 2,
  resources_to_change: 0,
  resources_to_destroy: 0,
  changes: {
    add: ["aws_instance.example", "aws_s3_bucket.data"],
    modify: [],
    destroy: []
  },
  summary: {
    total_changes: 2,
    additions: 2,
    changes: 0,
    deletions: 0
  }
};

// Complex nested data
const complexMockData = {
  terraform_plan: {
    version: "1.0",
    metadata: {
      backend: {
        type: "s3",
        config: {
          bucket: "terraform-state",
          key: "workspace/terraform.tfstate",
          region: "us-east-1",
          encrypt: true
        }
      },
      workspace: {
        name: "production",
        organization: "my-org"
      }
    },
    variables: {
      instance_type: {
        value: "t2.micro",
        sensitive: false
      },
      environment: {
        value: "production",
        sensitive: false
      },
      api_key: {
        value: "***",
        sensitive: true
      }
    },
    resources: {
      compute: [
        {
          type: "aws_instance",
          name: "web_server",
          changes: {
            create: {
              ami: "ami-0c55b159cbfafe1f0",
              instance_type: "t2.micro",
              tags: {
                Name: "Web Server",
                Role: "frontend"
              }
            }
          }
        }
      ],
      storage: [
        {
          type: "aws_s3_bucket",
          name: "assets",
          changes: {
            create: {
              bucket: "assets-bucket",
              versioning: {
                enabled: true
              },
              lifecycle_rules: [
                {
                  id: "delete_old_versions",
                  status: "Enabled",
                  noncurrent_version_expiration: {
                    days: 30
                  }
                }
              ]
            }
          }
        }
      ],
      networking: {
        vpc: {
          type: "aws_vpc",
          name: "main",
          changes: {
            create: {
              cidr_block: "10.0.0.0/16",
              enable_dns_hostnames: true,
              enable_dns_support: true,
              tags: {
                Name: "Main VPC"
              }
            }
          }
        },
        subnets: [
          {
            type: "aws_subnet",
            name: "public",
            changes: {
              create: {
                vpc_id: "${aws_vpc.main.id}",
                cidr_block: "10.0.1.0/24",
                availability_zone: "us-east-1a",
                map_public_ip_on_launch: true
              }
            }
          },
          {
            type: "aws_subnet",
            name: "private",
            changes: {
              create: {
                vpc_id: "${aws_vpc.main.id}",
                cidr_block: "10.0.2.0/24",
                availability_zone: "us-east-1b",
                map_public_ip_on_launch: false
              }
            }
          }
        ]
      }
    },
    outputs: {
      web_server_ip: {
        value: "${aws_instance.web_server.public_ip}",
        description: "Public IP of the web server"
      },
      vpc_id: {
        value: "${aws_vpc.main.id}",
        description: "ID of the VPC"
      }
    }
  }
};

export default function TestJsonViewer() {
  return (
    <div className="space-y-8 p-6 max-w-7xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold bg-gradient-to-r from-blue-600 via-indigo-600 to-purple-600 bg-clip-text text-transparent mb-2">
            JSON Viewer Test Page
          </h1>
          <p className="text-muted-foreground">
            Test the JSON viewer component with mock Terraform plan output data
          </p>
        </div>
        <Button variant="outline" asChild>
          <Link to="/dashboard">
            <ArrowLeft className="h-4 w-4 mr-2" />
            Back to Dashboard
          </Link>
        </Button>
      </div>

      {/* Simple Mock Data */}
      <div className="space-y-4">
        <h2 className="text-xl font-semibold">Simple Plan Output</h2>
        <JsonViewer 
          data={simpleMockData} 
          title="Simple Plan Summary"
          defaultExpanded={true}
          maxHeight="400px"
        />
      </div>

      {/* Complex Mock Data */}
      <div className="space-y-4">
        <h2 className="text-xl font-semibold">Complex Nested Plan Output</h2>
        <JsonViewer 
          data={complexMockData} 
          title="Complex Terraform Plan"
          defaultExpanded={false}
          maxHeight="600px"
        />
      </div>

      {/* Full Terraform Plan Output - Human Readable */}
      <div className="space-y-4">
        <h2 className="text-xl font-semibold">Full Terraform Plan Output (Human Readable)</h2>
        <p className="text-sm text-muted-foreground">
          This shows the plan output parsed into a human-readable format
        </p>
        <OutputViewer 
          data={mockPlanOutput} 
          title="Full Terraform Plan Output"
        />
      </div>

      {/* Full Terraform Plan Output - JSON */}
      <div className="space-y-4">
        <h2 className="text-xl font-semibold">Full Terraform Plan Output (JSON)</h2>
        <p className="text-sm text-muted-foreground">
          This represents a complete Terraform plan output structure in JSON format
        </p>
        <JsonViewer 
          data={mockPlanOutput} 
          title="Complete Terraform Plan"
          defaultExpanded={false}
          maxHeight="800px"
        />
      </div>

      {/* Array Data */}
      <div className="space-y-4">
        <h2 className="text-xl font-semibold">Array Data Example</h2>
        <JsonViewer 
          data={[
            { id: 1, name: "Resource 1", status: "created" },
            { id: 2, name: "Resource 2", status: "modified" },
            { id: 3, name: "Resource 3", status: "destroyed" }
          ]} 
          title="Resource Changes Array"
          defaultExpanded={true}
          maxHeight="300px"
        />
      </div>
    </div>
  );
}

