-- Migration: Create database user for application access
-- This creates a SQL Server login and database user with appropriate permissions

DECLARE @loginName NVARCHAR(100) = N'GreenSenseUser';
DECLARE @dbUser NVARCHAR(100) = N'GreenSenseUser';
DECLARE @password NVARCHAR(255) = N'GreenSense2024!';
DECLARE @dbName NVARCHAR(100) = N'GreenSenseDB';

-- Create SQL Server Login if it doesn't exist
IF NOT EXISTS (SELECT name FROM sys.server_principals WHERE name = @loginName)
BEGIN
    CREATE LOGIN [GreenSenseUser] WITH 
        PASSWORD = N'GreenSense2024!',
        DEFAULT_DATABASE = [master],
        CHECK_EXPIRATION = OFF,
        CHECK_POLICY = OFF;
    
    PRINT 'Login GreenSenseUser created successfully';
END
ELSE
BEGIN
    PRINT 'Login GreenSenseUser already exists';
END

-- Switch to target database
USE [GreenSenseDB];
GO

-- Create database user if it doesn't exist
IF NOT EXISTS (SELECT name FROM sys.database_principals WHERE name = @dbUser)
BEGIN
    CREATE USER [GreenSenseUser] FOR LOGIN [GreenSenseUser];
    
    -- Grant necessary permissions
    ALTER ROLE [db_datareader] ADD MEMBER [GreenSenseUser];
    ALTER ROLE [db_datawriter] ADD MEMBER [GreenSenseUser];
    ALTER ROLE [db_ddladmin] ADD MEMBER [GreenSenseUser];
    
    PRINT 'User GreenSenseUser created and permissions granted';
END
ELSE
BEGIN
    PRINT 'User GreenSenseUser already exists in database';
END
GO

PRINT 'Migration 002_create_app_user applied successfully';
