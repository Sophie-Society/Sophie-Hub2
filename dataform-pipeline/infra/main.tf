###############################################################################
# Sophie Society - BigQuery Reporting Infrastructure
#
# Creates:
#   1. Four BigQuery datasets (raw, curated, reporting, admin)
#   2. Dataform service account with minimal IAM roles
#   3. Dataform repository (optional, if using Dataform in GCP console)
#
# Usage:
#   cd infra
#   terraform init
#   terraform plan -var="project_id=YOUR_PROJECT_ID"
#   terraform apply -var="project_id=YOUR_PROJECT_ID"
###############################################################################

terraform {
  required_version = ">= 1.5.0"

  required_providers {
    google = {
      source  = "hashicorp/google"
      version = "~> 5.0"
    }
  }
}

provider "google" {
  project = var.project_id
  region  = var.region
}

# =============================================================================
# 1. BigQuery Datasets
# =============================================================================

resource "google_bigquery_dataset" "raw" {
  dataset_id    = "raw"
  friendly_name = "Raw Data"
  description   = "Raw data ingested from Daton/external sources. Read-only for Dataform."
  location      = var.bq_location

  labels = {
    env     = "production"
    managed = "terraform"
    layer   = "raw"
  }
}

resource "google_bigquery_dataset" "curated" {
  dataset_id    = "curated"
  friendly_name = "Curated Data"
  description   = "Canonical fact and dimension tables produced by Dataform."
  location      = var.bq_location

  labels = {
    env     = "production"
    managed = "terraform"
    layer   = "curated"
  }
}

resource "google_bigquery_dataset" "reporting" {
  dataset_id    = "reporting"
  friendly_name = "Reporting Rollups"
  description   = "Pre-aggregated rollup tables for dashboards and Sophie Hub."
  location      = var.bq_location

  labels = {
    env     = "production"
    managed = "terraform"
    layer   = "reporting"
  }
}

resource "google_bigquery_dataset" "admin" {
  dataset_id    = "admin"
  friendly_name = "Admin / Metadata"
  description   = "Pipeline metadata: freshness tracking, query history, assertions."
  location      = var.bq_location

  labels = {
    env     = "production"
    managed = "terraform"
    layer   = "admin"
  }
}

resource "google_bigquery_dataset" "dataform_assertions" {
  dataset_id    = "dataform_assertions"
  friendly_name = "Dataform Assertions"
  description   = "Data quality assertion results from Dataform."
  location      = var.bq_location

  labels = {
    env     = "production"
    managed = "terraform"
    layer   = "assertions"
  }
}

# =============================================================================
# 2. Service Account for Dataform
# =============================================================================

resource "google_service_account" "dataform" {
  account_id   = "dataform-pipeline"
  display_name = "Dataform Pipeline Service Account"
  description  = "Used by Dataform to read raw data and write curated/reporting tables."
}

# BigQuery Data Editor on curated, reporting, admin, assertions datasets
resource "google_bigquery_dataset_iam_member" "dataform_curated_editor" {
  dataset_id = google_bigquery_dataset.curated.dataset_id
  role       = "roles/bigquery.dataEditor"
  member     = "serviceAccount:${google_service_account.dataform.email}"
}

resource "google_bigquery_dataset_iam_member" "dataform_reporting_editor" {
  dataset_id = google_bigquery_dataset.reporting.dataset_id
  role       = "roles/bigquery.dataEditor"
  member     = "serviceAccount:${google_service_account.dataform.email}"
}

resource "google_bigquery_dataset_iam_member" "dataform_admin_editor" {
  dataset_id = google_bigquery_dataset.admin.dataset_id
  role       = "roles/bigquery.dataEditor"
  member     = "serviceAccount:${google_service_account.dataform.email}"
}

resource "google_bigquery_dataset_iam_member" "dataform_assertions_editor" {
  dataset_id = google_bigquery_dataset.dataform_assertions.dataset_id
  role       = "roles/bigquery.dataEditor"
  member     = "serviceAccount:${google_service_account.dataform.email}"
}

# BigQuery Data Viewer on raw dataset (read-only)
resource "google_bigquery_dataset_iam_member" "dataform_raw_viewer" {
  dataset_id = google_bigquery_dataset.raw.dataset_id
  role       = "roles/bigquery.dataViewer"
  member     = "serviceAccount:${google_service_account.dataform.email}"
}

# BigQuery Job User (required to run queries)
resource "google_project_iam_member" "dataform_bq_job_user" {
  project = var.project_id
  role    = "roles/bigquery.jobUser"
  member  = "serviceAccount:${google_service_account.dataform.email}"
}

# =============================================================================
# 3. Dataform Repository (optional - uncomment if using GCP Dataform console)
# =============================================================================

# resource "google_dataform_repository" "main" {
#   provider = google-beta
#   name     = var.dataform_repo_name
#   region   = var.region
#
#   git_remote_settings {
#     url            = var.dataform_git_url
#     default_branch = var.dataform_git_branch
#     # authentication_token_secret_version = "projects/${var.project_id}/secrets/dataform-git-token/versions/latest"
#   }
#
#   workspace_compilation_overrides {
#     default_database = var.project_id
#   }
# }

# =============================================================================
# Outputs
# =============================================================================

output "dataform_service_account_email" {
  description = "Email of the Dataform service account"
  value       = google_service_account.dataform.email
}

output "datasets" {
  description = "Created BigQuery datasets"
  value = {
    raw        = google_bigquery_dataset.raw.dataset_id
    curated    = google_bigquery_dataset.curated.dataset_id
    reporting  = google_bigquery_dataset.reporting.dataset_id
    admin      = google_bigquery_dataset.admin.dataset_id
    assertions = google_bigquery_dataset.dataform_assertions.dataset_id
  }
}
