namespace JobWorkflow.Api.Domain;

public sealed class CvDocument
{
    public Guid Id { get; set; } = Guid.NewGuid();
    public Guid UserId { get; set; }
    public AppUser? User { get; set; }
    public required string FileName { get; set; }
    public required string Content { get; set; }
    public byte[]? FileBytes { get; set; }
    public string? ContentType { get; set; }
    public DateTimeOffset CreatedAt { get; set; } = DateTimeOffset.UtcNow;
}
