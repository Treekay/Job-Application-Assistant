# JobWorkflow.Api

ASP.NET Core Web API backend for the Job Application Workflow Platform.

## Responsibilities

- JWT-based user registration, login, and password reset token flow
- EF Core domain model for CVs, job applications, documents, notes, status events, and reminders
- Saved / Applied / Interview / Offer / Rejected workflow transitions
- High / Medium / Low application priority
- Hosted background service for due reminder notifications
- AI-assisted match summary endpoint with deterministic fallback logic
- OpenAPI endpoint in development at `/openapi/v1.json`

## Project Structure

This project uses the common ASP.NET Core Web API layout:

- `Controllers/`: HTTP endpoints grouped by resource, such as auth, applications, CVs, dashboard, and admin
- `Contracts/`: request and response DTOs used by controllers
- `Domain/`: EF Core entity classes and workflow enums
- `Data/`: `AppDbContext` and database mapping configuration
- `Services/`: reusable business/infrastructure services, such as JWT, password hashing, email, reminders, and match summary generation
- `Program.cs`: dependency injection, authentication, CORS, OpenAPI, middleware, and `MapControllers()`

## Local Development

```bash
dotnet restore ../../JobWorkflow.sln
dotnet ef database update --project .
dotnet run
```

Default local DB is SQL Server LocalDB. For Azure SQL or SQL Server, override:

```bash
dotnet user-secrets set "ConnectionStrings:DefaultConnection" "<connection-string>"
dotnet user-secrets set "Jwt:Secret" "<long-random-secret>"
```
