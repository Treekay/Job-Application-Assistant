using JobWorkflow.Api.Contracts;
using JobWorkflow.Api.Data;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;

namespace JobWorkflow.Api.Controllers;

[ApiController]
[Authorize(Roles = "Admin")]
[Route("api/admin")]
public sealed class AdminController(AppDbContext db) : ControllerBase
{
    [HttpGet("users")]
    public async Task<ActionResult<IReadOnlyList<UserDto>>> ListUsers()
    {
        var users = await db.Users
            .ToListAsync();

        return Ok(users
            .OrderByDescending(user => user.CreatedAt)
            .Select(UserDto.From)
            .ToList());
    }
}
