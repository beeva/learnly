module "vpc" {
  source  = "terraform-aws-modules/vpc/aws"
  version = "~> 5.9"

  name = local.name
  cidr = "10.40.0.0/16"

  azs              = ["${var.region}a", "${var.region}b", "${var.region}c"]
  public_subnets   = ["10.40.0.0/20", "10.40.16.0/20", "10.40.32.0/20"]
  private_subnets  = ["10.40.64.0/20", "10.40.80.0/20", "10.40.96.0/20"]
  database_subnets = ["10.40.128.0/22", "10.40.132.0/22", "10.40.136.0/22"]

  enable_nat_gateway           = true
  single_nat_gateway           = var.environment != "production"
  create_database_subnet_group = true
}

resource "aws_security_group" "alb" {
  name   = "${local.name}-alb"
  vpc_id = module.vpc.vpc_id

  ingress {
    from_port   = 443
    to_port     = 443
    protocol    = "tcp"
    cidr_blocks = ["0.0.0.0/0"]
  }

  egress {
    from_port   = 0
    to_port     = 0
    protocol    = "-1"
    cidr_blocks = ["0.0.0.0/0"]
  }
}

resource "aws_security_group" "api" {
  name   = "${local.name}-api"
  vpc_id = module.vpc.vpc_id

  ingress {
    from_port       = 4000
    to_port         = 4000
    protocol        = "tcp"
    security_groups = [aws_security_group.alb.id]
  }

  egress {
    from_port   = 0
    to_port     = 0
    protocol    = "-1"
    cidr_blocks = ["0.0.0.0/0"]
  }
}
