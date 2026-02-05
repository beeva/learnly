# Infrastructure

Terraform for the Learnly AWS footprint (region `ap-southeast-1`).

| File | Resources |
|---|---|
| `network.tf` | VPC across three AZs, security groups |
| `database.tf` | RDS Postgres 16 (Multi-AZ in production) |
| `api.tf` | ECS Fargate service, ALB, autoscaling, secrets |
| `web.tf` | Private S3 bucket + CloudFront with SPA fallback |
| `monitoring.tf` | CloudWatch alarms, SNS alerts, nightly job schedule |

```bash
terraform init
terraform workspace select staging
terraform plan -var-file=staging.tfvars -var api_image=<ecr-image>
```

State is kept in S3 with DynamoDB locking. Never apply production from a laptop;
use the `Deploy` workflow instead.
