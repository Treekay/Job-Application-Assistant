using Microsoft.AspNetCore.Mvc;

namespace JobWorkflow.Api.Controllers;

[ApiController]
[Route("api/[controller]")]
public sealed class HealthController : ControllerBase
{
    [HttpGet]
    public IActionResult Get()
    {
        return Ok(new { ok = true, product = "Job Application Workflow Platform" });
    }
}
