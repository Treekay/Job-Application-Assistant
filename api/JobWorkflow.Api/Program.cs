using System.Text;
using System.Text.Json.Serialization;
using JobWorkflow.Api.Data;
using JobWorkflow.Api.Services;
using Microsoft.AspNetCore.Authentication.JwtBearer;
using Microsoft.EntityFrameworkCore;
using Microsoft.IdentityModel.Tokens;

var builder = WebApplication.CreateBuilder(args);
builder.Configuration.AddJsonFile("appsettings.Local.json", optional: true, reloadOnChange: true);
builder.Logging.ClearProviders();
builder.Logging.AddConsole();

var databaseProvider = builder.Configuration["Database:Provider"] ?? "SqlServer";
var connectionString = builder.Configuration.GetConnectionString("DefaultConnection")
    ?? (databaseProvider.Equals("Sqlite", StringComparison.OrdinalIgnoreCase)
        ? "Data Source=jobworkflow.db"
        : "Server=(localdb)\\MSSQLLocalDB;Database=JobWorkflow;Trusted_Connection=True;TrustServerCertificate=True");
var jwtSecret = builder.Configuration["Jwt:Secret"]
    ?? "dev-only-change-this-secret-before-deploying-to-azure";

builder.Services.AddDbContext<AppDbContext>(options =>
{
    if (databaseProvider.Equals("Sqlite", StringComparison.OrdinalIgnoreCase))
    {
        options.UseSqlite(connectionString);
        return;
    }

    options.UseSqlServer(connectionString);
});
builder.Services
    .AddControllers()
    .AddJsonOptions(options => options.JsonSerializerOptions.Converters.Add(new JsonStringEnumConverter()));
builder.Services.AddOpenApi();
builder.Services.AddCors(options =>
{
    var clientOrigins = builder.Configuration.GetSection("ClientOrigins").Get<string[]>()
        ?? ["http://localhost:5173", "http://127.0.0.1:5173"];

    options.AddPolicy("Client", policy => policy
        .WithOrigins(clientOrigins)
        .AllowAnyHeader()
        .AllowAnyMethod());
});
builder.Services.AddAuthentication(JwtBearerDefaults.AuthenticationScheme)
    .AddJwtBearer(options =>
    {
        options.TokenValidationParameters = new TokenValidationParameters
        {
            ValidateIssuer = true,
            ValidateAudience = true,
            ValidateLifetime = true,
            ValidateIssuerSigningKey = true,
            ValidIssuer = builder.Configuration["Jwt:Issuer"] ?? "JobWorkflow",
            ValidAudience = builder.Configuration["Jwt:Audience"] ?? "JobWorkflowClient",
            IssuerSigningKey = new SymmetricSecurityKey(Encoding.UTF8.GetBytes(jwtSecret))
        };
    });
builder.Services.AddAuthorization();
builder.Services.AddScoped<DatabaseInitializer>();
builder.Services.AddScoped<PasswordService>();
builder.Services.AddScoped<TokenService>();
builder.Services.AddScoped<CvTextExtractor>();
builder.Services.AddHttpClient<MatchSummaryService>();
builder.Services.AddHttpClient<ApplicationMaterialService>();
builder.Services.AddHttpClient<JobPostingImporter>();
builder.Services.AddSingleton<EmailTemplateService>();
builder.Services.AddHostedService<ReminderWorker>();

var app = builder.Build();

if (app.Environment.IsDevelopment())
{
    app.MapOpenApi();
    using var scope = app.Services.CreateScope();
    var db = scope.ServiceProvider.GetRequiredService<DatabaseInitializer>();
    await db.InitializeAsync();
}

app.UseCors("Client");
app.UseAuthentication();
app.UseAuthorization();
app.MapControllers();
app.Run();
