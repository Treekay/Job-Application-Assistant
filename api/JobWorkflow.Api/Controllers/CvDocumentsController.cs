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
[Route("api/cvs")]
public sealed class CvDocumentsController(AppDbContext db, CvTextExtractor extractor) : ControllerBase
{
    [HttpGet]
    public async Task<ActionResult<IReadOnlyList<CvDto>>> List()
    {
        var userId = User.UserId();
        var items = await db.CvDocuments
            .Where(cv => cv.UserId == userId)
            .ToListAsync();

        return Ok(items
            .OrderByDescending(cv => cv.CreatedAt)
            .Select(CvDto.From)
            .ToList());
    }

    [HttpPost]
    public ActionResult<CvDto> Create(CreateCvRequest request)
    {
        return BadRequest(new { message = "CV library only accepts PDF uploads. Please upload a PDF CV." });
    }

    [HttpGet("{id:guid}")]
    public async Task<ActionResult<CvDetailDto>> Get(Guid id)
    {
        var userId = User.UserId();
        var cv = await db.CvDocuments.SingleOrDefaultAsync(item => item.Id == id && item.UserId == userId);

        return cv is null ? NotFound() : Ok(CvDetailDto.From(cv));
    }

    [HttpGet("{id:guid}/file")]
    public async Task<IActionResult> GetFile(Guid id)
    {
        var userId = User.UserId();
        var cv = await db.CvDocuments.SingleOrDefaultAsync(item => item.Id == id && item.UserId == userId);
        if (cv?.FileBytes is null || cv.FileBytes.Length == 0)
        {
            return NotFound(new { message = "This CV does not have a PDF file stored. Please re-upload it as a PDF." });
        }

        return File(cv.FileBytes, cv.ContentType ?? "application/pdf", cv.FileName);
    }

    [HttpDelete("{id:guid}")]
    public async Task<IActionResult> Delete(Guid id)
    {
        var userId = User.UserId();
        var cv = await db.CvDocuments.SingleOrDefaultAsync(item => item.Id == id && item.UserId == userId);
        if (cv is null)
        {
            return NotFound();
        }

        var linkedApplications = await db.JobApplications
            .Where(app => app.UserId == userId && app.CvDocumentId == id)
            .ToListAsync();
        foreach (var application in linkedApplications)
        {
            application.CvDocumentId = null;
            application.UpdatedAt = DateTimeOffset.UtcNow;
        }

        db.CvDocuments.Remove(cv);
        await db.SaveChangesAsync();
        return NoContent();
    }

    [HttpPost("upload")]
    [RequestSizeLimit(8 * 1024 * 1024)]
    public async Task<ActionResult<CvDto>> Upload(IFormFile file, CancellationToken cancellationToken)
    {
        if (file.Length == 0)
        {
            return BadRequest(new { message = "Upload a CV file first." });
        }
        if (!string.Equals(Path.GetExtension(file.FileName), ".pdf", StringComparison.OrdinalIgnoreCase))
        {
            return BadRequest(new { message = "Only PDF CV uploads are supported." });
        }

        var text = await extractor.ExtractAsync(file, cancellationToken);
        if (string.IsNullOrWhiteSpace(text))
        {
                return BadRequest(new { message = "Could not extract text from this CV." });
        }
        await using var stream = new MemoryStream();
        await file.CopyToAsync(stream, cancellationToken);

        var cv = new CvDocument
        {
            UserId = User.UserId(),
            FileName = file.FileName,
            Content = text,
            FileBytes = stream.ToArray(),
            ContentType = "application/pdf"
        };
        db.CvDocuments.Add(cv);
        await db.SaveChangesAsync(cancellationToken);

        return Created($"/api/cvs/{cv.Id}", CvDto.From(cv));
    }
}
