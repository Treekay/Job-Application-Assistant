namespace JobWorkflow.Api.Domain;

public sealed class ApplicationStatusEvent
{
    public Guid Id { get; set; } = Guid.NewGuid();
    public Guid JobApplicationId { get; set; }
    public JobApplication? JobApplication { get; set; }
    public ApplicationStatus Status { get; set; }
    public string? Comment { get; set; }
    public DateTimeOffset CreatedAt { get; set; } = DateTimeOffset.UtcNow;
}
