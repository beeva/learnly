variable "environment" {
  description = "Deployment environment (staging or production)."
  type        = string

  validation {
    condition     = contains(["staging", "production"], var.environment)
    error_message = "environment must be staging or production."
  }
}

variable "region" {
  type    = string
  default = "ap-southeast-1"
}

variable "domain" {
  description = "Apex domain, e.g. learnly.app"
  type        = string
}

variable "api_image" {
  description = "Fully qualified API container image (set by CI)."
  type        = string
}

variable "api_desired_count" {
  type    = number
  default = 2
}

variable "db_instance_class" {
  type    = string
  default = "db.t4g.medium"
}
