using JobWorkflow.Api.Data;
using Microsoft.EntityFrameworkCore;

namespace JobWorkflow.Api.Services;

public sealed class ReminderWorker(
    IServiceScopeFactory scopeFactory,
    EmailTemplateService email,
    ILogger<ReminderWorker> logger) : BackgroundService
{
    protected override async Task ExecuteAsync(CancellationToken stoppingToken)
    {
        while (!stoppingToken.IsCancellationRequested)
        {
            try
            {
                await SendDueReminders(stoppingToken);
            }
            catch (Exception ex)
            {
                logger.LogError(ex, "Reminder worker failed.");
            }

            await Task.Delay(TimeSpan.FromMinutes(5), stoppingToken);
        }
    }

    private async Task SendDueReminders(CancellationToken stoppingToken)
    {
        using var scope = scopeFactory.CreateScope();
        var db = scope.ServiceProvider.GetRequiredService<AppDbContext>();
        var now = DateTimeOffset.UtcNow;
        var due = await db.Reminders
            .Include(reminder => reminder.JobApplication)
            .Where(reminder => reminder.SentAt == null)
            .Take(25)
            .ToListAsync(stoppingToken);

        due = due.Where(reminder => reminder.DueAt <= now).ToList();

        foreach (var reminder in due)
        {
            email.QueueReminder(
                "user@example.com",
                $"{reminder.Kind}: {reminder.JobApplication?.RoleTitle}",
                reminder.Message);
            reminder.SentAt = now;
        }

        await db.SaveChangesAsync(stoppingToken);
    }
}
