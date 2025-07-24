terraform {
  required_version = ">= 1.8"

  required_providers {
    aws = {
      source  = "hashicorp/aws"
      version = "~> 5.60"
    }
  }

  backend "s3" {
    bucket         = "learnly-terraform-state"
    key            = "learnly/terraform.tfstate"
    region         = "ap-southeast-1"
    dynamodb_table = "learnly-terraform-locks"
    encrypt        = true
  }
}

provider "aws" {
  region = var.region

  default_tags {
    tags = {
      Project     = "learnly"
      Environment = var.environment
      ManagedBy   = "terraform"
    }
  }
}

locals {
  name = "learnly-${var.environment}"
}
