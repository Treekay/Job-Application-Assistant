using JobWorkflow.Api.Contracts;
using JobWorkflow.Api.Services;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace JobWorkflow.Api.Controllers;

[ApiController]
[Authorize]
[Route("api/job-imports")]
public sealed class JobImportsController(JobPostingImporter importer) : ControllerBase
{
    [HttpPost]
    public async Task<ActionResult<JobImportDto>> Import(ImportJobRequest request, CancellationToken cancellationToken)
    {
        if (!Uri.TryCreate(request.Url, UriKind.Absolute, out _))
        {
            return BadRequest(new { message = "Enter a valid job URL." });
        }

        var job = await importer.ImportAsync(request.Url, cancellationToken);
        return Ok(job);
    }
}
