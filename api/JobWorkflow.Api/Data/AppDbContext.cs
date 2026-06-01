using JobWorkflow.Api.Domain;
using Microsoft.EntityFrameworkCore;

namespace JobWorkflow.Api.Data;

public sealed class AppDbContext(DbContextOptions<AppDbContext> options) : DbContext(options)
{
    public DbSet<AppUser> Users => Set<AppUser>();
    public DbSet<CvDocument> CvDocuments => Set<CvDocument>();
    public DbSet<JobApplication> JobApplications => Set<JobApplication>();
    public DbSet<ApplicationDocument> ApplicationDocuments => Set<ApplicationDocument>();
    public DbSet<ApplicationNote> ApplicationNotes => Set<ApplicationNote>();
    public DbSet<ApplicationStatusEvent> StatusEvents => Set<ApplicationStatusEvent>();
    public DbSet<Reminder> Reminders => Set<Reminder>();

    protected override void OnModelCreating(ModelBuilder modelBuilder)
    {
        modelBuilder.Entity<AppUser>(entity =>
        {
            entity.HasIndex(user => user.Email).IsUnique();
            entity.Property(user => user.Email).HasMaxLength(256);
            entity.Property(user => user.DisplayName).HasMaxLength(160);
            entity.Property(user => user.Role).HasMaxLength(40);
        });

        modelBuilder.Entity<CvDocument>(entity =>
        {
            entity.Property(cv => cv.FileName).HasMaxLength(260);
            entity.Property(cv => cv.ContentType).HasMaxLength(120);
            if (Database.IsSqlServer())
            {
                entity.Property(cv => cv.Content).HasColumnType("nvarchar(max)");
                entity.Property(cv => cv.FileBytes).HasColumnType("varbinary(max)");
            }
        });

        modelBuilder.Entity<JobApplication>(entity =>
        {
            entity.HasIndex(app => new { app.UserId, app.Status, app.UpdatedAt });
            entity.HasIndex(app => new { app.UserId, app.Priority });
            entity.Property(app => app.CompanyName).HasMaxLength(180);
            entity.Property(app => app.RoleTitle).HasMaxLength(240);
            entity.Property(app => app.Source).HasMaxLength(120);
            entity.Property(app => app.JobUrl).HasMaxLength(1200);
            if (Database.IsSqlServer())
            {
                entity.Property(app => app.JobDescription).HasColumnType("nvarchar(max)");
            }
            entity.Property(app => app.Notes).HasMaxLength(4000);
            entity.Property(app => app.MatchSummary).HasMaxLength(4000);
            entity.Property(app => app.MissingSkills).HasMaxLength(2000);
            if (Database.IsSqlServer())
            {
                entity.Property(app => app.MatchAnalysisJson).HasColumnType("nvarchar(max)");
            }
            entity.HasMany(app => app.NotesHistory)
                .WithOne(note => note.JobApplication)
                .HasForeignKey(note => note.JobApplicationId)
                .OnDelete(DeleteBehavior.Cascade);
        });

        modelBuilder.Entity<ApplicationDocument>(entity =>
        {
            entity.Property(document => document.Title).HasMaxLength(240);
            if (Database.IsSqlServer())
            {
                entity.Property(document => document.Content).HasColumnType("nvarchar(max)");
            }
        });

        modelBuilder.Entity<ApplicationNote>(entity =>
        {
            entity.Property(note => note.Body).HasMaxLength(4000);
        });

        modelBuilder.Entity<Reminder>(entity =>
        {
            entity.HasIndex(reminder => new { reminder.UserId, reminder.DueAt, reminder.SentAt });
            entity.Property(reminder => reminder.Message).HasMaxLength(500);
        });
    }
}
