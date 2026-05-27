namespace JobWorkflow.Api.Domain;

public sealed class JobApplication
{
    public Guid Id { get; set; } = Guid.NewGuid();
    public Guid UserId { get; set; }
    public AppUser? User { get; set; }
    public Guid? CvDocumentId { get; set; }
    public CvDocument? CvDocument { get; set; }
    public required string CompanyName { get; set; }
    public required string RoleTitle { get; set; }
    public string? Source { get; set; }
    public string? JobUrl { get; set; }
    public string? JobDescription { get; set; }
    public ApplicationStatus Status { get; set; } = ApplicationStatus.Saved;
    public ApplicationPriority Priority { get; set; } = ApplicationPriority.Medium;
    public DateTimeOffset? Deadline { get; set; }
    public string? MatchSummary { get; set; }
    public string? MissingSkills { get; set; }
    public string? Notes { get; set; }
    public DateTimeOffset CreatedAt { get; set; } = DateTimeOffset.UtcNow;
    public DateTimeOffset UpdatedAt { get; set; } = DateTimeOffset.UtcNow;

    public ICollection<ApplicationDocument> Documents { get; set; } = [];
    public ICollection<ApplicationNote> NotesHistory { get; set; } = [];
    public ICollection<ApplicationStatusEvent> StatusEvents { get; set; } = [];
    public ICollection<Reminder> Reminders { get; set; } = [];
}
