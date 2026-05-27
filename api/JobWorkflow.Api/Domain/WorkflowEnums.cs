namespace JobWorkflow.Api.Domain;

public enum ApplicationStatus
{
    Saved,
    Applied,
    Interview,
    Offer,
    Rejected
}

public enum ApplicationPriority
{
    Low,
    Medium,
    High
}

public enum DocumentType
{
    Cv,
    CoverLetter,
    Email,
    Other
}

public enum ReminderKind
{
    FollowUp,
    Interview,
    Deadline,
    Custom
}
