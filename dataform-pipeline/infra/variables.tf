variable "project_id" {
  description = "GCP project ID"
  type        = string
}

variable "region" {
  description = "GCP region for Dataform and BigQuery"
  type        = string
  default     = "us-central1"
}

variable "bq_location" {
  description = "BigQuery dataset location"
  type        = string
  default     = "US"
}

variable "dataform_repo_name" {
  description = "Name of the Dataform repository"
  type        = string
  default     = "sophie-reporting-pipeline"
}

variable "dataform_git_url" {
  description = "Git remote URL for Dataform repository"
  type        = string
  default     = ""
}

variable "dataform_git_branch" {
  description = "Git branch for Dataform to track"
  type        = string
  default     = "main"
}
