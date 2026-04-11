IF OBJECT_ID('dbo.PasswordResetTokens', 'U') IS NULL
BEGIN
  CREATE TABLE dbo.PasswordResetTokens (
    id_token_reset INT IDENTITY(1,1) NOT NULL PRIMARY KEY,
    id_usuario INT NOT NULL,
    token_hash NVARCHAR(64) NOT NULL,
    expira_en DATETIME NOT NULL,
    usado_en DATETIME NULL,
    fecha_creacion DATETIME NOT NULL CONSTRAINT DF_PasswordResetTokens_FechaCreacion DEFAULT (GETDATE())
  );

  ALTER TABLE dbo.PasswordResetTokens
  ADD CONSTRAINT FK_PasswordResetTokens_Usuarios
    FOREIGN KEY (id_usuario) REFERENCES dbo.Usuarios(id_usuario);

  CREATE UNIQUE INDEX UX_PasswordResetTokens_TokenHash
    ON dbo.PasswordResetTokens(token_hash);

  CREATE INDEX IX_PasswordResetTokens_UsuarioEstado
    ON dbo.PasswordResetTokens(id_usuario, usado_en, expira_en);
END;
