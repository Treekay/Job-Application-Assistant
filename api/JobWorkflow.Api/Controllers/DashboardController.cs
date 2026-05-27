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
[Route("api/[controller]")]
public sealed class DashboardController(AppDbContext db) : ControllerBase
{
    [HttpGet]
    public async Task<ActionResult<DashboardDto>> Get()
    {
        var userId = User.UserId();
        var applications = await db.JobApplications.Where(app => app.UserId == userId).ToListAsync();
        var grouped = applications
            .GroupBy(app => app.Status)
            .ToDictionary(group => group.Key.ToString(), group => group.Count());

        return Ok(new DashboardDto(
            applications.Count,
            grouped,
            applications.Count(app => app.Deadline >= DateTimeOffset.UtcNow && app.Deadline <= DateTimeOffset.UtcNow.AddDays(7)),
            applications.Count(app => app.Priority == ApplicationPriority.High)));
    }
}
