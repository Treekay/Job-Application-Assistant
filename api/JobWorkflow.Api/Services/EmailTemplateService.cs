using System.Net;
using System.Net.Mail;

namespace JobWorkflow.Api.Services;

public sealed class EmailTemplateService(IConfiguration configuration, ILogger<EmailTemplateService> logger)
{
    public void QueuePasswordReset(string email, string token)
    {
        SendOrLog(
            email,
            "Reset your Job Workflow password",
            $"Use this reset token within 30 minutes: {token}");
    }

    public void QueueReminder(string email, string subject, string body)
    {
        SendOrLog(email, subject, body);
    }

    private void SendOrLog(string recipient, string subject, string body)
    {
        var host = configuration["Smtp:Host"];
        var from = configuration["Smtp:From"] ?? "no-reply@jobworkflow.local";

        if (string.IsNullOrWhiteSpace(host))
        {
            logger.LogInformation("Email queued for {Recipient}: {Subject} - {Body}", recipient, subject, body);
            return;
        }

        using var client = new SmtpClient(host, int.Parse(configuration["Smtp:Port"] ?? "587"))
        {
            EnableSsl = bool.Parse(configuration["Smtp:EnableSsl"] ?? "true")
        };
        var username = configuration["Smtp:Username"];
        var password = configuration["Smtp:Password"];
        if (!string.IsNullOrWhiteSpace(username) && !string.IsNullOrWhiteSpace(password))
        {
            client.Credentials = new NetworkCredential(username, password);
        }

        client.Send(new MailMessage(from, recipient, subject, body));
    }
}
