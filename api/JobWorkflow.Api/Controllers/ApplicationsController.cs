using JobWorkflow.Api.Contracts;
using JobWorkflow.Api.Data;
using JobWorkflow.Api.Domain;
using JobWorkflow.Api.Services;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;

namespace JobWorkflow.Api.Controllers;

[ApiController]
[Authorize]
[Route("api/applications")]
public sealed class ApplicationsController(AppDbContext db, MatchSummaryService matches) : ControllerBase
{
    [HttpGet]
    public async Task<ActionResult<IReadOnlyList<ApplicationDto>>> List()
    {
        var userId = User.UserId();
        var items = await db.JobApplications
            .Include(app => app.Reminders)
            .Include(app => app.Documents)
            .Where(app => app.UserId == userId)
            .ToListAsync();

        return Ok(items
            .OrderByDescending(app => app.UpdatedAt)
            .Select(ApplicationDto.From)
            .ToList());
    }

    [HttpPost]
    public async Task<ActionResult<ApplicationDto>> Create(CreateApplicationRequest request)
    {
        var application = new JobApplication
        {
            UserId = User.UserId(),
            CompanyName = request.CompanyName.Trim(),
            RoleTitle = request.RoleTitle.Trim(),
            JobUrl = request.JobUrl?.Trim(),
            JobDescription = request.JobDescription?.Trim(),
            Source = request.Source?.Trim() ?? "Manual",
            Priority = request.Priority,
            Status = ApplicationStatus.Saved,
            Deadline = request.Deadline,
            CvDocumentId = request.CvDocumentId,
            Notes = request.Notes?.Trim()
        };
        db.JobApplications.Add(application);
        await db.SaveChangesAsync();

        return CreatedAtAction(nameof(Get), new { id = application.Id }, ApplicationDto.From(application));
    }

    [HttpGet("{id:guid}")]
    public async Task<ActionResult<ApplicationDto>> Get(Guid id)
    {
        var application = await FindOwnedApplication(id)
            .Include(app => app.Documents)
            .Include(app => app.Reminders)
            .SingleOrDefaultAsync();

        return application is null ? NotFound() : Ok(ApplicationDto.From(application));
    }

    [HttpPatch("{id:guid}/status")]
    public async Task<ActionResult<ApplicationDto>> UpdateStatus(Guid id, UpdateStatusRequest request)
    {
        var application = await FindOwnedApplication(id).SingleOrDefaultAsync();
        if (application is null) return NotFound();

        application.Status = request.Status;
        application.UpdatedAt = DateTimeOffset.UtcNow;
        db.StatusEvents.Add(new ApplicationStatusEvent
        {
            JobApplicationId = application.Id,
            Status = request.Status,
            Comment = request.Comment
        });
        await db.SaveChangesAsync();
        return Ok(ApplicationDto.From(application));
    }

    [HttpPatch("{id:guid}/priority")]
    public async Task<ActionResult<ApplicationDto>> UpdatePriority(Guid id, UpdatePriorityRequest request)
    {
        var application = await FindOwnedApplication(id).SingleOrDefaultAsync();
        if (application is null) return NotFound();

        application.Priority = request.Priority;
        application.UpdatedAt = DateTimeOffset.UtcNow;
        await db.SaveChangesAsync();
        return Ok(ApplicationDto.From(application));
    }

    [HttpDelete("{id:guid}")]
    public async Task<IActionResult> Delete(Guid id)
    {
        var application = await FindOwnedApplication(id).SingleOrDefaultAsync();
        if (application is null) return NotFound();

        db.JobApplications.Remove(application);
        await db.SaveChangesAsync();
        return NoContent();
    }

    [HttpPost("{id:guid}/documents")]
    public async Task<IActionResult> AddDocument(Guid id, UpsertDocumentRequest request)
    {
        var application = await FindOwnedApplication(id).SingleOrDefaultAsync();
        if (application is null) return NotFound();

        db.ApplicationDocuments.Add(new ApplicationDocument
        {
            JobApplicationId = application.Id,
            Type = request.Type,
            Title = request.Title.Trim(),
            Content = request.Content.Trim()
        });
        application.UpdatedAt = DateTimeOffset.UtcNow;
        await db.SaveChangesAsync();
        return Ok();
    }

    [HttpPost("{id:guid}/notes")]
    public async Task<IActionResult> AddNote(Guid id, AddNoteRequest request)
    {
        var application = await FindOwnedApplication(id).SingleOrDefaultAsync();
        if (application is null) return NotFound();

        db.ApplicationNotes.Add(new ApplicationNote
        {
            JobApplicationId = application.Id,
            Body = request.Body.Trim()
        });
        application.UpdatedAt = DateTimeOffset.UtcNow;
        await db.SaveChangesAsync();
        return Ok();
    }

    [HttpPost("{id:guid}/reminders")]
    public async Task<IActionResult> AddReminder(Guid id, CreateReminderRequest request)
    {
        var application = await FindOwnedApplication(id).SingleOrDefaultAsync();
        if (application is null) return NotFound();

        db.Reminders.Add(new Reminder
        {
            JobApplicationId = application.Id,
            UserId = User.UserId(),
            Kind = request.Kind,
            DueAt = request.DueAt,
            Message = request.Message.Trim()
        });
        await db.SaveChangesAsync();
        return Ok();
    }

    [HttpPost("{id:guid}/match-summary")]
    public async Task<ActionResult<MatchSummaryResponse>> GenerateMatchSummary(Guid id, GenerateMatchRequest request)
    {
        var application = await FindOwnedApplication(id)
            .Include(app => app.CvDocument)
            .SingleOrDefaultAsync();
        if (application is null) return NotFound();

        var summary = await matches.GenerateAsync(application, request.JobDescription);
        application.MatchSummary = summary.Summary;
        application.MissingSkills = summary.MissingSkills;
        application.UpdatedAt = DateTimeOffset.UtcNow;
        await db.SaveChangesAsync();
        return Ok(summary);
    }

    private IQueryable<JobApplication> FindOwnedApplication(Guid id)
    {
        var userId = User.UserId();
        return db.JobApplications.Where(app => app.Id == id && app.UserId == userId);
    }
}
