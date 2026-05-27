using Microsoft.Data.SqlClient;
using Microsoft.EntityFrameworkCore;

namespace JobWorkflow.Api.Data;

public sealed class DatabaseInitializer(AppDbContext db)
{
    public async Task InitializeAsync()
    {
        await db.Database.EnsureCreatedAsync();
        if (db.Database.IsSqlServer())
        {
            await AddColumnIfMissingAsync(
                "CvDocuments",
                "FileBytes",
                "varbinary(max) NULL");
            await AddColumnIfMissingAsync(
                "CvDocuments",
                "ContentType",
                "nvarchar(120) NULL");
            await AddColumnIfMissingAsync(
                "JobApplications",
                "JobDescription",
                "nvarchar(max) NULL");
            return;
        }

        if (db.Database.IsSqlite())
        {
            await AddSqliteColumnIfMissingAsync("CvDocuments", "FileBytes", "BLOB NULL");
            await AddSqliteColumnIfMissingAsync("CvDocuments", "ContentType", "TEXT NULL");
            await AddSqliteColumnIfMissingAsync("JobApplications", "JobDescription", "TEXT NULL");
        }
    }

    private async Task AddColumnIfMissingAsync(string tableName, string columnName, string definition)
    {
        var connection = (SqlConnection)db.Database.GetDbConnection();
        if (connection.State != System.Data.ConnectionState.Open)
        {
            await connection.OpenAsync();
        }

        await using var command = connection.CreateCommand();
        command.CommandText = """
            IF COL_LENGTH(@tableName, @columnName) IS NULL
            BEGIN
                DECLARE @sql nvarchar(max) = N'ALTER TABLE ' + QUOTENAME(@tableName) + N' ADD ' + QUOTENAME(@columnName) + N' ' + @definition;
                EXEC sp_executesql @sql;
            END
            """;
        command.Parameters.AddWithValue("@tableName", tableName);
        command.Parameters.AddWithValue("@columnName", columnName);
        command.Parameters.AddWithValue("@definition", definition);
        await command.ExecuteNonQueryAsync();
    }

    private async Task AddSqliteColumnIfMissingAsync(string tableName, string columnName, string definition)
    {
        var connection = db.Database.GetDbConnection();
        if (connection.State != System.Data.ConnectionState.Open)
        {
            await connection.OpenAsync();
        }

        await using var check = connection.CreateCommand();
        check.CommandText = $"PRAGMA table_info(\"{tableName}\")";
        var exists = false;
        await using var reader = await check.ExecuteReaderAsync();
        while (await reader.ReadAsync())
        {
            if (string.Equals(reader.GetString(1), columnName, StringComparison.OrdinalIgnoreCase))
            {
                exists = true;
                break;
            }
        }
        await reader.DisposeAsync();
        if (exists)
        {
            return;
        }

        await using var alter = connection.CreateCommand();
        alter.CommandText = $"ALTER TABLE \"{tableName}\" ADD COLUMN \"{columnName}\" {definition}";
        await alter.ExecuteNonQueryAsync();
    }
}
