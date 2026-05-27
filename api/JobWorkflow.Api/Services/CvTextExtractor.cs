using DocumentFormat.OpenXml.Packaging;
using DocumentFormat.OpenXml.Wordprocessing;
using System.Text;
using System.Text.RegularExpressions;
using UglyToad.PdfPig;

namespace JobWorkflow.Api.Services;

public sealed class CvTextExtractor
{
    public async Task<string> ExtractAsync(IFormFile file, CancellationToken cancellationToken = default)
    {
        var extension = Path.GetExtension(file.FileName).ToLowerInvariant();
        await using var stream = new MemoryStream();
        await file.CopyToAsync(stream, cancellationToken);
        stream.Position = 0;

        return extension switch
        {
            ".txt" => ReadPlainText(stream),
            ".md" => ReadPlainText(stream),
            ".rtf" => ReadRtf(stream),
            ".pdf" => ReadPdf(stream),
            ".doc" => throw new InvalidOperationException("Legacy .doc files are not supported reliably. Please save the CV as .docx or PDF and upload it again."),
            ".docx" => ReadDocx(stream),
            _ => throw new InvalidOperationException("Supported CV uploads: .pdf, .docx, .txt, .md, and .rtf. Legacy .doc files should be saved as .docx or PDF first.")
        };
    }

    private static string ReadPlainText(Stream stream)
    {
        using var reader = new StreamReader(stream, Encoding.UTF8, detectEncodingFromByteOrderMarks: true);
        return reader.ReadToEnd();
    }

    private static string ReadDocx(Stream stream)
    {
        using var document = WordprocessingDocument.Open(stream, false);
        var body = document.MainDocumentPart?.Document.Body;
        if (body is null)
        {
            return "";
        }

        return string.Join(
            Environment.NewLine,
            body.Descendants<Paragraph>().Select(paragraph => paragraph.InnerText).Where(text => !string.IsNullOrWhiteSpace(text)));
    }

    private static string ReadPdf(Stream stream)
    {
        using var document = PdfDocument.Open(stream);
        var pages = document.GetPages()
            .Select(page => string.Join(" ", page.GetWords().Select(word => word.Text)))
            .Where(text => !string.IsNullOrWhiteSpace(text));

        return CleanExtractedText(string.Join(Environment.NewLine + Environment.NewLine, pages));
    }

    private static string ReadRtf(Stream stream)
    {
        using var reader = new StreamReader(stream, Encoding.UTF8, detectEncodingFromByteOrderMarks: true);
        var text = reader.ReadToEnd();
        text = Regex.Replace(text, @"\\'[0-9a-fA-F]{2}", " ");
        text = Regex.Replace(text, @"\\[a-zA-Z]+\d* ?", " ");
        text = text.Replace(@"\{", "{").Replace(@"\}", "}").Replace(@"\~", " ");
        text = Regex.Replace(text, @"[{}]", " ");
        return Regex.Replace(text, @"\s+", " ").Trim();
    }

    private static string CleanExtractedText(string text)
    {
        text = Regex.Replace(text, @"\s+", " ").Trim();
        text = Regex.Replace(text, @"(?<=[a-z])(?=[A-Z])", " ");
        text = Regex.Replace(text, @"(?<=[a-zA-Z])(?=\d)", " ");
        text = Regex.Replace(text, @"(?<=\d)(?=[a-zA-Z])", " ");
        text = Regex.Replace(text, @"(?<=[.!?])\s+", Environment.NewLine);
        return text.Trim();
    }
}
