# Job Application Workflow Platform

A workflow/productivity SaaS for tracking job applications, managing application documents, scheduling reminders, and generating targeted match summaries.

This project has been migrated from an AI-first MVP into a full-stack product that better matches common NZ full-stack / graduate / junior backend job descriptions.

## Stack

- Backend: ASP.NET Core Web API
- Frontend: React + TypeScript + Vite
- Database: SQL Server / Azure SQL via Entity Framework Core
- Auth: JWT-based registration, login, and password reset flow
- Email/reminders: hosted background service with SMTP-ready notification boundary
- API docs: ASP.NET OpenAPI endpoint
- Cloud target: Azure App Service + Azure SQL
- CI/CD: GitHub Actions

The legacy Node/Express backend has been removed. The active backend is the .NET API under `api/JobWorkflow.Api`.

## Product Scope

- User registration, login, and reset-password token flow
- Upload PDF CV files into the CV library. The platform stores the original PDF for preview and extracts text for AI matching.
- Save job applications independently of AI analysis
- Import a job posting from its original URL and keep the source link on the application
- Status workflow: Saved / Applied / Interview / Offer / Rejected
- Associate each role with CV, job description, cover letter, email draft, notes, and deadline
- Generate structured AI match analysis, missing requirements, recommendations, final report, cover letter drafts, and outreach email drafts for a target job
- Follow-up / interview / deadline reminders
- Dashboard statistics by status, priority, and upcoming deadlines
- Optional role-based admin endpoint

## Run Locally

For local AI calls, copy the local config example and fill in your key:

```bash
cp api/JobWorkflow.Api/appsettings.Local.example.json api/JobWorkflow.Api/appsettings.Local.json
```

`appsettings.Local.json` is ignored by Git and should contain your real `OpenAI:ApiKey`.

```bash
npm install
dotnet restore JobWorkflow.sln
npm run dev
```

Client: http://localhost:5173
API: http://localhost:5043

Windows shortcut:

```powershell
.\start-dev.ps1
```

Git Bash:

```bash
./start-dev.sh
```

Stop from Git Bash:

```bash
./stop-dev.sh
```

Or from CMD:

```bash
./start-dev.cmd
```

Development OpenAPI document:

```text
/openapi/v1.json
```

## Useful Commands

```bash
npm run build --workspace client
dotnet build JobWorkflow.sln
```

## Deployment Notes

- Deploy `api/JobWorkflow.Api` to Azure App Service.
- Use Azure SQL and set `ConnectionStrings:DefaultConnection`.
- Set a strong `Jwt:Secret` in App Service configuration.
- Add SMTP provider settings before turning reminder logging into real outbound email.
