using JobWorkflow.Api.Contracts;
using JobWorkflow.Api.Data;
using JobWorkflow.Api.Domain;
using JobWorkflow.Api.Services;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;

namespace JobWorkflow.Api.Controllers;

[ApiController]
[Route("api/[controller]")]
public sealed class AuthController(
    AppDbContext db,
    PasswordService passwords,
    TokenService tokens,
    EmailTemplateService email) : ControllerBase
{
    [HttpPost("register")]
    public async Task<ActionResult<AuthResponse>> Register(RegisterRequest request)
    {
        var normalizedEmail = request.Email.Trim().ToLowerInvariant();
        if (await db.Users.AnyAsync(user => user.Email == normalizedEmail))
        {
            return Conflict(new { message = "Email is already registered." });
        }

        var user = new AppUser
        {
            Email = normalizedEmail,
            DisplayName = request.DisplayName.Trim(),
            PasswordHash = passwords.Hash(request.Password),
            Role = "User"
        };
        db.Users.Add(user);
        await db.SaveChangesAsync();

        return CreatedAtAction(nameof(Me), AuthResponse.From(user, tokens.Create(user)));
    }

    [HttpPost("login")]
    public async Task<ActionResult<AuthResponse>> Login(LoginRequest request)
    {
        var normalizedEmail = request.Email.Trim().ToLowerInvariant();
        var user = await db.Users.SingleOrDefaultAsync(item => item.Email == normalizedEmail);
        if (user is null || !passwords.Verify(request.Password, user.PasswordHash))
        {
            return Unauthorized();
        }

        user.LastLoginAt = DateTimeOffset.UtcNow;
        await db.SaveChangesAsync();
        return Ok(AuthResponse.From(user, tokens.Create(user)));
    }

    [HttpPost("password/forgot")]
    public async Task<IActionResult> ForgotPassword(ForgotPasswordRequest request)
    {
        var user = await db.Users.SingleOrDefaultAsync(item => item.Email == request.Email.Trim().ToLowerInvariant());
        if (user is not null)
        {
            user.PasswordResetToken = Convert.ToHexString(Guid.NewGuid().ToByteArray());
            user.PasswordResetExpiresAt = DateTimeOffset.UtcNow.AddMinutes(30);
            await db.SaveChangesAsync();
            email.QueuePasswordReset(user.Email, user.PasswordResetToken);
        }

        return Ok(new { message = "If the email exists, a reset link will be sent." });
    }

    [HttpPost("password/reset")]
    public async Task<IActionResult> ResetPassword(ResetPasswordRequest request)
    {
        var user = await db.Users.SingleOrDefaultAsync(item =>
            item.PasswordResetToken == request.Token && item.PasswordResetExpiresAt > DateTimeOffset.UtcNow);
        if (user is null)
        {
            return BadRequest(new { message = "Reset token is invalid or expired." });
        }

        user.PasswordHash = passwords.Hash(request.NewPassword);
        user.PasswordResetToken = null;
        user.PasswordResetExpiresAt = null;
        await db.SaveChangesAsync();
        return Ok(new { message = "Password updated." });
    }

    [Authorize]
    [HttpGet("me")]
    public async Task<ActionResult<UserDto>> Me()
    {
        var user = await db.Users.FindAsync(User.UserId());
        return user is null ? Unauthorized() : Ok(UserDto.From(user));
    }
}
