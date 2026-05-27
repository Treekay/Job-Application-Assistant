namespace JobWorkflow.Api.Domain;

public sealed class AppUser
{
    public Guid Id { get; set; } = Guid.NewGuid();
    public required string Email { get; set; }
    public required string DisplayName { get; set; }
    public required string PasswordHash { get; set; }
    public string Role { get; set; } = "User";
    public string? PasswordResetToken { get; set; }
    public DateTimeOffset? PasswordResetExpiresAt { get; set; }
    public DateTimeOffset CreatedAt { get; set; } = DateTimeOffset.UtcNow;
    public DateTimeOffset? LastLoginAt { get; set; }

    public ICollection<CvDocument> CvDocuments { get; set; } = [];
    public ICollection<JobApplication> JobApplications { get; set; } = [];
}
