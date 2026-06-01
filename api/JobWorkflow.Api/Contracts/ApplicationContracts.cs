using System.Text.Json;
using JobWorkflow.Api.Domain;

namespace JobWorkflow.Api.Contracts;

public sealed record CreateCvRequest(string FileName, string Content);

public sealed record CvDto(Guid Id, string FileName, DateTimeOffset CreatedAt)
{
    public static CvDto From(CvDocument cv) => new(cv.Id, cv.FileName, cv.CreatedAt);
}

public sealed record CvDetailDto(Guid Id, string FileName, string Content, DateTimeOffset CreatedAt)
{
    public static CvDetailDto From(CvDocument cv) => new(cv.Id, cv.FileName, cv.Content, cv.CreatedAt);
}

public sealed record CreateApplicationRequest(
    string CompanyName,
    string RoleTitle,
    string? JobUrl,
    string? JobDescription,
    string? Source,
    ApplicationPriority Priority,
    Guid? CvDocumentId,
    DateTimeOffset? Deadline,
    string? Notes);

public sealed record UpdateApplicationRequest(
    string CompanyName,
    string RoleTitle,
    string? JobUrl,
    string? JobDescription,
    string? Source,
    ApplicationPriority Priority,
    Guid? CvDocumentId,
    DateTimeOffset? Deadline,
    string? Notes);

public sealed record UpdateStatusRequest(ApplicationStatus Status, string? Comment);
public sealed record UpdatePriorityRequest(ApplicationPriority Priority);
public sealed record UpsertDocumentRequest(DocumentType Type, string Title, string Content);
public sealed record AddNoteRequest(string Body);
public sealed record CreateReminderRequest(ReminderKind Kind, DateTimeOffset DueAt, string Message);
public sealed record GenerateMatchRequest(string? JobDescription);
public sealed record RequirementAnalysisDto(string Requirement, string Priority, string Evidence, string Notes);
public sealed record MatchSummaryResponse(
    string Summary,
    string MissingSkills,
    int Score,
    IReadOnlyList<RequirementAnalysisDto> MatchedRequirements,
    IReadOnlyList<RequirementAnalysisDto> MissingRequirements,
    IReadOnlyList<string> Evidence,
    IReadOnlyList<string> Recommendations,
    string FinalReport);
public sealed record GeneratedMaterialResponse(string Content);
public sealed record ImportJobRequest(string Url);
public sealed record JobImportDto(
    string CompanyName,
    string RoleTitle,
    string Source,
    string JobUrl,
    string Description);
public sealed record DashboardDto(
    int TotalApplications,
    IReadOnlyDictionary<string, int> ByStatus,
    int DeadlinesThisWeek,
    int HighPriorityCount);

public sealed record ApplicationDto(
    Guid Id,
    string CompanyName,
    string RoleTitle,
    string? JobUrl,
    string? JobDescription,
    string? Source,
    ApplicationStatus Status,
    ApplicationPriority Priority,
    DateTimeOffset? Deadline,
    string? MatchSummary,
    string? MissingSkills,
    MatchSummaryResponse? MatchAnalysis,
    string? Notes,
    Guid? CvDocumentId,
    DateTimeOffset CreatedAt,
    DateTimeOffset UpdatedAt,
    IReadOnlyList<DocumentDto> Documents,
    IReadOnlyList<ReminderDto> Reminders)
{
    public static ApplicationDto From(JobApplication application) => new(
        application.Id,
        application.CompanyName,
        application.RoleTitle,
        application.JobUrl,
        application.JobDescription,
        application.Source,
        application.Status,
        application.Priority,
        application.Deadline,
        application.MatchSummary,
        application.MissingSkills,
        ReadMatchAnalysis(application.MatchAnalysisJson),
        application.Notes,
        application.CvDocumentId,
        application.CreatedAt,
        application.UpdatedAt,
        application.Documents.Select(DocumentDto.From).ToList(),
        application.Reminders.Select(ReminderDto.From).ToList());

    private static MatchSummaryResponse? ReadMatchAnalysis(string? value)
    {
        if (string.IsNullOrWhiteSpace(value)) return null;
        try
        {
            return JsonSerializer.Deserialize<MatchSummaryResponse>(value);
        }
        catch (JsonException)
        {
            return null;
        }
    }
}

public sealed record DocumentDto(Guid Id, DocumentType Type, string Title, DateTimeOffset UpdatedAt)
{
    public static DocumentDto From(ApplicationDocument document) =>
        new(document.Id, document.Type, document.Title, document.UpdatedAt);
}

public sealed record ReminderDto(Guid Id, ReminderKind Kind, DateTimeOffset DueAt, bool IsSent, string Message)
{
    public static ReminderDto From(Reminder reminder) =>
        new(reminder.Id, reminder.Kind, reminder.DueAt, reminder.IsSent, reminder.Message);
}
