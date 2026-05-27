namespace JobWorkflow.Api.Domain;

public sealed class ApplicationNote
{
    public Guid Id { get; set; } = Guid.NewGuid();
    public Guid JobApplicationId { get; set; }
    public JobApplication? JobApplication { get; set; }
    public required string Body { get; set; }
    public DateTimeOffset CreatedAt { get; set; } = DateTimeOffset.UtcNow;
}
