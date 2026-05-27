using System.Net;
using System.Text.RegularExpressions;
using JobWorkflow.Api.Contracts;

namespace JobWorkflow.Api.Services;

public sealed class JobPostingImporter(HttpClient httpClient)
{
    public async Task<JobImportDto> ImportAsync(string url, CancellationToken cancellationToken = default)
    {
        using var request = new HttpRequestMessage(HttpMethod.Get, url);
        request.Headers.UserAgent.ParseAdd("JobWorkflow/1.0");
        using var response = await httpClient.SendAsync(request, cancellationToken);
        response.EnsureSuccessStatusCode();

        var html = await response.Content.ReadAsStringAsync(cancellationToken);
        var text = CleanHtml(html);
        return new JobImportDto(
            CompanyName: ExtractCompany(html, text),
            RoleTitle: ExtractTitle(html, text),
            Source: new Uri(url).Host,
            JobUrl: url,
            Description: text.Length > 12000 ? text[..12000] : text);
    }

    private static string ExtractTitle(string html, string text)
    {
        var title = MatchMeta(html, "og:title")
            ?? Regex.Match(html, @"<title[^>]*>([\s\S]*?)</title>", RegexOptions.IgnoreCase).Groups[1].Value
            ?? "";
        title = WebUtility.HtmlDecode(CleanHtml(title));
        if (!string.IsNullOrWhiteSpace(title))
        {
            return Regex.Replace(title, @"\s*[-|]\s*(SEEK|Indeed|LinkedIn).*$", "", RegexOptions.IgnoreCase).Trim();
        }

        return text.Split('\n', StringSplitOptions.RemoveEmptyEntries).FirstOrDefault()?.Trim() ?? "";
    }

    private static string ExtractCompany(string html, string text)
    {
        var company = MatchMeta(html, "og:site_name");
        if (!string.IsNullOrWhiteSpace(company))
        {
            return WebUtility.HtmlDecode(company.Trim());
        }

        var match = Regex.Match(text, @"(?:Company|Employer)\s*[:\-]\s*(.+)", RegexOptions.IgnoreCase);
        return match.Success ? match.Groups[1].Value.Trim()[..Math.Min(match.Groups[1].Value.Trim().Length, 120)] : "";
    }

    private static string? MatchMeta(string html, string property)
    {
        var pattern = $@"<meta[^>]+(?:property|name)=[""']{Regex.Escape(property)}[""'][^>]+content=[""']([^""']+)[""']";
        var match = Regex.Match(html, pattern, RegexOptions.IgnoreCase);
        return match.Success ? match.Groups[1].Value : null;
    }

    private static string CleanHtml(string html)
    {
        var withoutScripts = Regex.Replace(html, @"<script[\s\S]*?</script>|<style[\s\S]*?</style>", " ", RegexOptions.IgnoreCase);
        var text = Regex.Replace(withoutScripts, "<[^>]+>", "\n");
        text = WebUtility.HtmlDecode(text);
        return Regex.Replace(text, @"[ \t]+\n|\n{3,}|\s{2,}", "\n").Trim();
    }
}
