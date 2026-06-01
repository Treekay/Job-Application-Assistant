using System.Text;
using System.Text.Json;
using System.Text.RegularExpressions;
using JobWorkflow.Api.Contracts;
using JobWorkflow.Api.Domain;

namespace JobWorkflow.Api.Services;

public sealed class MatchSummaryService(HttpClient httpClient, IConfiguration configuration)
{
    private static readonly JsonSerializerOptions JsonOptions = new(JsonSerializerDefaults.Web);
    private static readonly string[] CommonSkills =
    [
        "c#", ".net", "asp.net", "sql", "postgresql", "sql server", "azure", "aws",
        "react", "typescript", "javascript", "api", "rest api", "microservices", "docker",
        "ci/cd", "entity framework", "security", "testing", "agile", "git", "python",
        "fastapi", "mysql", "vue", "gcp", "cloud run", "rabbitmq", "kinesis"
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
        var matched = jdSkills.Intersect(cvSkills, StringComparer.OrdinalIgnoreCase).Take(8).ToArray();
        var missing = jdSkills.Except(cvSkills, StringComparer.OrdinalIgnoreCase).Take(8).ToArray();

        var matchedRequirements = matched
            .Select(skill => new RequirementAnalysisDto(skill, "Medium", $"The CV includes evidence related to {skill}.", "Use this evidence directly in the tailored application."))
            .ToArray();
        var missingRequirements = missing
            .Select(skill => new RequirementAnalysisDto(skill, "Medium", $"The JD asks for {skill}, but the CV has no clear evidence.", "Add truthful project evidence, learning context, or avoid overstating this area."))
            .ToArray();
        var score = CalculateScore(matchedRequirements, missingRequirements);
        var summary = matched.Length == 0
            ? "No strong skill overlap has been detected yet. Attach a CV and add a richer job description before applying."
            : $"Detected {matched.Length} relevant overlaps for {application.RoleTitle}, including {string.Join(", ", matched)}.";
        var recommendations = missing.Length == 0
            ? ["Keep the application concise and map the strongest evidence to the role requirements."]
            : missing.Select(skill => $"Clarify your evidence for {skill} if it is genuinely part of your experience.").ToArray();

        return new MatchSummaryResponse(
            summary,
            string.Join(", ", missing),
            score,
            matchedRequirements,
            missingRequirements,
            matched.Select(skill => $"CV and JD both mention {skill}.").ToArray(),
            recommendations,
            BuildFinalReport(application, summary, score, matchedRequirements, missingRequirements, recommendations));
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
                    content = """
                        You are a practical job-application analyst. Return only compact JSON.
                        Do not invent experience. Use the CV as evidence and the JD as requirements.
                        Required JSON shape:
                        {
                          "summary": "...",
                          "matchedRequirements": [{"requirement":"...", "priority":"High|Medium|Low", "evidence":"...", "notes":"..."}],
                          "missingRequirements": [{"requirement":"...", "priority":"High|Medium|Low", "evidence":"...", "notes":"..."}],
                          "evidence": ["..."],
                          "recommendations": ["..."],
                          "finalReport": "markdown report"
                        }
                        Do not include score; the application will calculate it.
                        """
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
            var root = result.RootElement;
            var matched = ReadRequirementList(root, "matchedRequirements");
            var missing = ReadRequirementList(root, "missingRequirements");
            var evidence = ReadStringArray(root, "evidence");
            var recommendations = ReadStringArray(root, "recommendations");
            var summary = ReadString(root, "summary");

            if (matched.Count == 0 && missing.Count == 0)
            {
                return null;
            }

            var score = CalculateScore(matched, missing);
            if (string.IsNullOrWhiteSpace(summary))
            {
                summary = $"Matched {matched.Count} requirement(s) and found {missing.Count} gap(s) for {application.RoleTitle}.";
            }

            var missingSkills = string.Join(", ", missing.Select(item => item.Requirement));
            var finalReport = ReadString(root, "finalReport");
            if (string.IsNullOrWhiteSpace(finalReport))
            {
                finalReport = BuildFinalReport(application, summary, score, matched, missing, recommendations);
            }

            return new MatchSummaryResponse(summary, missingSkills, score, matched, missing, evidence, recommendations, finalReport);
        }
        catch (JsonException)
        {
            return null;
        }
    }

    private static string BuildFinalReport(
        JobApplication application,
        string summary,
        int score,
        IReadOnlyList<RequirementAnalysisDto> matched,
        IReadOnlyList<RequirementAnalysisDto> missing,
        IReadOnlyList<string> recommendations)
    {
        var report = new StringBuilder();
        report.AppendLine($"## Match report for {application.RoleTitle} at {application.CompanyName}");
        report.AppendLine();
        report.AppendLine($"**Fit score:** {score}%");
        report.AppendLine();
        report.AppendLine(summary);
        report.AppendLine();
        report.AppendLine("### Matched requirements");
        foreach (var item in matched.Take(8))
        {
            report.AppendLine($"- **{item.Requirement}** ({item.Priority}): {item.Evidence}");
        }
        report.AppendLine();
        report.AppendLine("### Gaps");
        foreach (var item in missing.Take(8))
        {
            report.AppendLine($"- **{item.Requirement}** ({item.Priority}): {item.Notes}");
        }
        report.AppendLine();
        report.AppendLine("### Recommended next steps");
        foreach (var item in recommendations.Take(6))
        {
            report.AppendLine($"- {item}");
        }
        return report.ToString().Trim();
    }

    private static int CalculateScore(IReadOnlyList<RequirementAnalysisDto> matched, IReadOnlyList<RequirementAnalysisDto> missing)
    {
        var matchedWeight = matched.Sum(item => PriorityWeight(item.Priority));
        var totalWeight = matchedWeight + missing.Sum(item => PriorityWeight(item.Priority));
        if (totalWeight <= 0) return 0;
        return Math.Clamp((int)Math.Round((double)matchedWeight / totalWeight * 100), 0, 100);
    }

    private static int PriorityWeight(string priority) =>
        priority.Equals("High", StringComparison.OrdinalIgnoreCase) ? 3 :
        priority.Equals("Medium", StringComparison.OrdinalIgnoreCase) ? 2 : 1;

    private static List<RequirementAnalysisDto> ReadRequirementList(JsonElement root, string propertyName)
    {
        if (!root.TryGetProperty(propertyName, out var element) || element.ValueKind != JsonValueKind.Array)
        {
            return [];
        }

        return element.EnumerateArray()
            .Select(item => new RequirementAnalysisDto(
                ReadString(item, "requirement"),
                NormalizePriority(ReadString(item, "priority")),
                ReadString(item, "evidence"),
                ReadString(item, "notes")))
            .Where(item => !string.IsNullOrWhiteSpace(item.Requirement))
            .Take(12)
            .ToList();
    }

    private static IReadOnlyList<string> ReadStringArray(JsonElement root, string propertyName)
    {
        if (!root.TryGetProperty(propertyName, out var element))
        {
            return [];
        }

        if (element.ValueKind == JsonValueKind.Array)
        {
            return element.EnumerateArray()
                .Select(item => item.ToString().Trim())
                .Where(item => !string.IsNullOrWhiteSpace(item))
                .Take(12)
                .ToArray();
        }

        var value = element.ToString().Trim();
        return string.IsNullOrWhiteSpace(value) ? [] : [value];
    }

    private static string ReadString(JsonElement root, string propertyName)
    {
        return root.TryGetProperty(propertyName, out var element) && element.ValueKind == JsonValueKind.String
            ? element.GetString() ?? ""
            : "";
    }

    private static string NormalizePriority(string priority)
    {
        if (priority.Equals("High", StringComparison.OrdinalIgnoreCase)) return "High";
        if (priority.Equals("Low", StringComparison.OrdinalIgnoreCase)) return "Low";
        return "Medium";
    }

    private static HashSet<string> ExtractSkills(string text)
    {
        var normalized = Regex.Replace(text.ToLowerInvariant(), @"\s+", " ");
        return CommonSkills
            .Where(skill => normalized.Contains(skill, StringComparison.OrdinalIgnoreCase))
            .ToHashSet(StringComparer.OrdinalIgnoreCase);
    }
}
