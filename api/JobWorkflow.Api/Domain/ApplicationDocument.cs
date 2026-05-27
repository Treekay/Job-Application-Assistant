namespace JobWorkflow.Api.Domain;

public sealed class ApplicationDocument
{
    public Guid Id { get; set; } = Guid.NewGuid();
    public Guid JobApplicationId { get; set; }
    public JobApplication? JobApplication { get; set; }
    public DocumentType Type { get; set; }
    public required string Title { get; set; }
    public required string Content { get; set; }
    public DateTimeOffset UpdatedAt { get; set; } = DateTimeOffset.UtcNow;
}
