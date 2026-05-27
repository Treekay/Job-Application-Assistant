using System.Text.RegularExpressions;
using System.Text;
using System.Text.Json;
using JobWorkflow.Api.Contracts;
using JobWorkflow.Api.Domain;

namespace JobWorkflow.Api.Services;

public sealed class MatchSummaryService(HttpClient httpClient, IConfiguration configuration)
{
    private static readonly string[] CommonSkills =
    [
        "c#", ".net", "asp.net", "sql", "postgresql", "sql server", "azure", "aws",
        "react", "typescript", "javascript", "api", "microservices", "docker",
        "ci/cd", "entity framework", "security", "testing", "agile"
    ];

    public async Task<MatchSummaryResponse> GenerateAsync(JobApplication application, string? jobDescription)
    {
        var apiKey = configuration["OpenAI:ApiKey"];
        if (!string.IsNullOrWhiteSpace(apiKey))
        {
            var generated = await TryGenerateWithOpenAi(application, jobDescription, apiKey);
            if (generated is not null)
            {
                return generated;
            }
        }

        return GenerateFallback(application, jobDescription);
    }

    private static MatchSummaryResponse GenerateFallback(JobApplication application, string? jobDescription)
    {
        var cvText = application.CvDocument?.Content ?? string.Empty;
        var jdText = jobDescription ?? application.JobDescription ?? application.Notes ?? string.Empty;
        var cvSkills = ExtractSkills(cvText);
        var jdSkills = ExtractSkills(jdText);
        var missing = jdSkills.Except(cvSkills, StringComparer.OrdinalIgnoreCase).Take(8).ToArray();
        var matched = jdSkills.Intersect(cvSkills, StringComparer.OrdinalIgnoreCase).Take(8).ToArray();
        var score = jdSkills.Count == 0 ? 0 : (int)Math.Round((double)matched.Length / jdSkills.Count * 100);

        var summary = matched.Length == 0
            ? "No strong skill overlap has been detected yet. Attach a CV and add a richer job description before applying."
            : $"Detected {matched.Length} relevant overlaps for {application.RoleTitle}, including {string.Join(", ", matched)}.";

        return new MatchSummaryResponse(summary, string.Join(", ", missing), score);
    }

    private async Task<MatchSummaryResponse?> TryGenerateWithOpenAi(
        JobApplication application,
        string? jobDescription,
        string apiKey)
    {
        using var request = new HttpRequestMessage(HttpMethod.Post, "https://api.openai.com/v1/chat/completions");
        request.Headers.Authorization = new System.Net.Http.Headers.AuthenticationHeaderValue("Bearer", apiKey);
        var payload = new
        {
            model = configuration["OpenAI:Model"] ?? "gpt-4o-mini",
            messages = new[]
            {
                new
                {
                    role = "system",
                    content = "Return compact JSON with summary, missingSkills, and score. Be practical and evidence-based."
                },
                new
                {
                    role = "user",
                    content = JsonSerializer.Serialize(new
                    {
                        application.CompanyName,
                        application.RoleTitle,
                        Cv = application.CvDocument?.Content ?? "",
                        JobDescription = jobDescription ?? application.JobDescription ?? application.Notes ?? ""
                    })
                }
            },
            response_format = new { type = "json_object" }
        };
        request.Content = new StringContent(JsonSerializer.Serialize(payload), Encoding.UTF8, "application/json");
        using var response = await httpClient.SendAsync(request);
        if (!response.IsSuccessStatusCode)
        {
            return null;
        }

        using var json = JsonDocument.Parse(await response.Content.ReadAsStringAsync());
        var content = json.RootElement
            .GetProperty("choices")[0]
            .GetProperty("message")
            .GetProperty("content")
            .GetString();
        if (string.IsNullOrWhiteSpace(content))
        {
            return null;
        }

        try
        {
            using var result = JsonDocument.Parse(content);
            var summary = ReadString(result.RootElement, "summary");
            var missingSkills = ReadListOrString(result.RootElement, "missingSkills");
            var score = ReadScore(result.RootElement);

            if (string.IsNullOrWhiteSpace(summary) && string.IsNullOrWhiteSpace(missingSkills) && score == 0)
            {
                return null;
            }

            if (string.IsNullOrWhiteSpace(summary))
            {
                summary = "The AI response completed, but did not include a summary. Review the missing skills and retry analysis if needed.";
            }

            return new MatchSummaryResponse(summary, missingSkills, score);
        }
        catch (JsonException)
        {
            return null;
        }
    }

    private static string ReadString(JsonElement root, string propertyName)
    {
        return root.TryGetProperty(propertyName, out var element) && element.ValueKind == JsonValueKind.String
            ? element.GetString() ?? ""
            : "";
    }

    private static string ReadListOrString(JsonElement root, string propertyName)
    {
        if (!root.TryGetProperty(propertyName, out var element))
        {
            return "";
        }

        if (element.ValueKind == JsonValueKind.Array)
        {
            return string.Join(", ", element.EnumerateArray().Select(item => item.ToString()));
        }

        return element.ToString();
    }

    private static int ReadScore(JsonElement root)
    {
        if (!root.TryGetProperty("score", out var scoreElement))
        {
            return 0;
        }

        if (scoreElement.ValueKind == JsonValueKind.Number && scoreElement.TryGetInt32(out var parsedScore))
        {
            return Math.Clamp(parsedScore, 0, 100);
        }

        if (scoreElement.ValueKind == JsonValueKind.String &&
            int.TryParse(Regex.Match(scoreElement.GetString() ?? "", @"\d+").Value, out var parsedStringScore))
        {
            return Math.Clamp(parsedStringScore, 0, 100);
        }

        return 0;
    }

    private static HashSet<string> ExtractSkills(string text)
    {
        var normalized = Regex.Replace(text.ToLowerInvariant(), @"\s+", " ");
        return CommonSkills
            .Where(skill => normalized.Contains(skill, StringComparison.OrdinalIgnoreCase))
            .ToHashSet(StringComparer.OrdinalIgnoreCase);
    }
}
