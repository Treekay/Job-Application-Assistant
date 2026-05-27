using System.IdentityModel.Tokens.Jwt;
using System.Security.Claims;
using System.Text;
using JobWorkflow.Api.Domain;
using Microsoft.IdentityModel.Tokens;

namespace JobWorkflow.Api.Services;

public sealed class TokenService(IConfiguration configuration)
{
    public string Create(AppUser user)
    {
        var secret = configuration["Jwt:Secret"] ?? "dev-only-change-this-secret-before-deploying-to-azure";
        var credentials = new SigningCredentials(
            new SymmetricSecurityKey(Encoding.UTF8.GetBytes(secret)),
            SecurityAlgorithms.HmacSha256);
        var claims = new[]
        {
            new Claim(ClaimTypes.NameIdentifier, user.Id.ToString()),
            new Claim(ClaimTypes.Email, user.Email),
            new Claim(ClaimTypes.Name, user.DisplayName),
            new Claim(ClaimTypes.Role, user.Role)
        };
        var token = new JwtSecurityToken(
            issuer: configuration["Jwt:Issuer"] ?? "JobWorkflow",
            audience: configuration["Jwt:Audience"] ?? "JobWorkflowClient",
            claims: claims,
            expires: DateTime.UtcNow.AddHours(8),
            signingCredentials: credentials);

        return new JwtSecurityTokenHandler().WriteToken(token);
    }
}
