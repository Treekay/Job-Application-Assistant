using System.Text;
using System.Text.Json;
using JobWorkflow.Api.Contracts;
using JobWorkflow.Api.Domain;

namespace JobWorkflow.Api.Services;

public sealed class ApplicationMaterialService(HttpClient httpClient, IConfiguration configuration)
{
    public async Task<GeneratedMaterialResponse> GenerateCoverLetterAsync(JobApplication application)
    {
        var prompt = """
            Write a concise, natural cover letter for this job application.
            Tone: polite, measured, practical, not exaggerated, not pushy.
            Keep it around 180-240 words.
            Use only evidence from the CV, notes, and match analysis.
            If evidence is missing, phrase interest and transferable fit honestly.
            Return JSON: {"content":"..."}
            """;

        var fallback = BuildFallbackCoverLetter(application);
        return new GeneratedMaterialResponse(await GenerateAsync(application, prompt, fallback));
    }

    public async Task<GeneratedMaterialResponse> GenerateEmailAsync(JobApplication application)
    {
        var prompt = """
            Write a short application or recruiter outreach email.
            Tone reference: natural, brief, respectful, not overclaiming, not too formal.
            Keep it under 140 words.
            Mention the role, why it is relevant, and ask for a reasonable next step.
            Return JSON: {"content":"..."}
            """;

        var fallback = BuildFallbackEmail(application);
        return new GeneratedMaterialResponse(await GenerateAsync(application, prompt, fallback));
    }

    private async Task<string> GenerateAsync(JobApplication application, string systemPrompt, string fallback)
    {
        var apiKey = configuration["OpenAI:ApiKey"];
        if (string.IsNullOrWhiteSpace(apiKey))
        {
            return fallback;
        }

        using var request = new HttpRequestMessage(HttpMethod.Post, "https://api.openai.com/v1/chat/completions");
        request.Headers.Authorization = new System.Net.Http.Headers.AuthenticationHeaderValue("Bearer", apiKey);
        var payload = new
        {
            model = configuration["OpenAI:Model"] ?? "gpt-4o-mini",
            messages = new[]
            {
                new { role = "system", content = systemPrompt },
                new
                {
                    role = "user",
                    content = JsonSerializer.Serialize(new
                    {
                        application.CompanyName,
                        application.RoleTitle,
                        application.Source,
                        application.JobDescription,
                        application.Notes,
                        MatchAnalysis = application.MatchAnalysisJson,
                        Cv = application.CvDocument?.Content ?? ""
                    })
                }
            },
            response_format = new { type = "json_object" }
        };
        request.Content = new StringContent(JsonSerializer.Serialize(payload), Encoding.UTF8, "application/json");

        using var response = await httpClient.SendAsync(request);
        if (!response.IsSuccessStatusCode)
        {
            return fallback;
        }

        try
        {
            using var json = JsonDocument.Parse(await response.Content.ReadAsStringAsync());
            var content = json.RootElement
                .GetProperty("choices")[0]
                .GetProperty("message")
                .GetProperty("content")
                .GetString();
            if (string.IsNullOrWhiteSpace(content))
            {
                return fallback;
            }

            using var result = JsonDocument.Parse(content);
            return result.RootElement.TryGetProperty("content", out var element)
                ? element.GetString() ?? fallback
                : fallback;
        }
        catch (JsonException)
        {
            return fallback;
        }
    }

    private static string BuildFallbackCoverLetter(JobApplication application)
    {
        var company = string.IsNullOrWhiteSpace(application.CompanyName) ? "your team" : application.CompanyName;
        var role = string.IsNullOrWhiteSpace(application.RoleTitle) ? "this role" : application.RoleTitle;
        var summary = string.IsNullOrWhiteSpace(application.MatchSummary)
            ? "My background appears relevant to the core requirements, and I would be glad to discuss the fit in more detail."
            : application.MatchSummary;

        return $"""
            Hi {company} team,

            I hope you're doing well. I'm interested in the {role} opportunity and wanted to briefly introduce myself.

            {summary}

            I would appreciate the chance to discuss how my experience could contribute to the role. I'm happy to provide any further details and work around your process.

            Kind regards,
            """.Trim();
    }

    private static string BuildFallbackEmail(JobApplication application)
    {
        var company = string.IsNullOrWhiteSpace(application.CompanyName) ? "your team" : application.CompanyName;
        var role = string.IsNullOrWhiteSpace(application.RoleTitle) ? "the role" : application.RoleTitle;

        return $"""
            Hi {company} team,

            I hope you're doing well. I'm interested in the {role} opportunity and wanted to ask whether you would be open to reviewing my application.

            My background seems relevant to the role requirements, and I'd be happy to share any further details if useful.

            Thank you for your time.
            """.Trim();
    }
}
