namespace JobWorkflow.Api.Domain;

public sealed class Reminder
{
    public Guid Id { get; set; } = Guid.NewGuid();
    public Guid UserId { get; set; }
    public Guid JobApplicationId { get; set; }
    public JobApplication? JobApplication { get; set; }
    public ReminderKind Kind { get; set; }
    public required string Message { get; set; }
    public DateTimeOffset DueAt { get; set; }
    public DateTimeOffset? SentAt { get; set; }
    public bool IsSent => SentAt.HasValue;
}
