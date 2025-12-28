output "api_url" {
  value = "http://${aws_lb.api.dns_name}"
}

output "web_distribution_domain" {
  value = aws_cloudfront_distribution.web.domain_name
}

output "web_distribution_id" {
  value = aws_cloudfront_distribution.web.id
}

output "database_endpoint" {
  value     = aws_db_instance.main.endpoint
  sensitive = true
}
