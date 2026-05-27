using JobWorkflow.Api.Domain;

namespace JobWorkflow.Api.Contracts;

public sealed record RegisterRequest(string Email, string Password, string DisplayName);
public sealed record LoginRequest(string Email, string Password);
public sealed record ForgotPasswordRequest(string Email);
public sealed record ResetPasswordRequest(string Token, string NewPassword);

public sealed record AuthResponse(string Token, UserDto User)
{
    public static AuthResponse From(AppUser user, string token) => new(token, UserDto.From(user));
}

public sealed record UserDto(Guid Id, string Email, string DisplayName, string Role)
{
    public static UserDto From(AppUser user) => new(user.Id, user.Email, user.DisplayName, user.Role);
}
