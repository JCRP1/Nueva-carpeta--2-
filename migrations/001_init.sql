-- Migration: Initial database schema for GreenSense
-- This creates all necessary tables if they don't exist

-- Empresas table
IF NOT EXISTS (SELECT * FROM sysobjects WHERE name='Empresas' AND xtype='U')
BEGIN
    CREATE TABLE Empresas (
        id_empresa INT IDENTITY(1,1) PRIMARY KEY,
        nombre NVARCHAR(200) NOT NULL,
        direccion NVARCHAR(500),
        telefono NVARCHAR(50),
        correo NVARCHAR(200),
        estado NVARCHAR(50),
        fecha_creacion DATETIME DEFAULT GETDATE()
    );
END

-- Usuarios table
IF NOT EXISTS (SELECT * FROM sysobjects WHERE name='Usuarios' AND xtype='U')
BEGIN
    CREATE TABLE Usuarios (
        id_usuario INT IDENTITY(1,1) PRIMARY KEY,
        id_empresa INT NOT NULL FOREIGN KEY REFERENCES Empresas(id_empresa),
        nombre NVARCHAR(200) NOT NULL,
        correo NVARCHAR(200) NOT NULL UNIQUE,
        [contraseña] NVARCHAR(255) NOT NULL,
        rol NVARCHAR(50) NOT NULL,
        fecha_registro DATETIME DEFAULT GETDATE(),
        activo BIT DEFAULT 1
    );
END

-- Invernaderos table
IF NOT EXISTS (SELECT * FROM sysobjects WHERE name='Invernaderos' AND xtype='U')
BEGIN
    CREATE TABLE Invernaderos (
        id_invernadero INT IDENTITY(1,1) PRIMARY KEY,
        id_empresa INT NOT NULL FOREIGN KEY REFERENCES Empresas(id_empresa),
        nombre NVARCHAR(200) NOT NULL,
        ubicacion NVARCHAR(500),
        superficie_m2 DECIMAL(10,2),
        estado NVARCHAR(50) DEFAULT 'activo'
    );
END

-- ZonasRiego table
IF NOT EXISTS (SELECT * FROM sysobjects WHERE name='ZonasRiego' AND xtype='U')
BEGIN
    CREATE TABLE ZonasRiego (
        id_zona INT IDENTITY(1,1) PRIMARY KEY,
        nombre NVARCHAR(200) NOT NULL,
        id_invernadero INT NOT NULL FOREIGN KEY REFERENCES Invernaderos(id_invernadero),
        cultivoActual NVARCHAR(200),
        estadoRiego NVARCHAR(50) DEFAULT 'inactivo',
        umbralHumedad DECIMAL(5,2),
        humedadActual DECIMAL(5,2) DEFAULT 0,
        ultimoRiego DATETIME NULL,
        duracionUltimoRiego INT DEFAULT 0,
        volumenUltimoRiego DECIMAL(10,2) DEFAULT 0
    );
END

-- Sensores table
IF NOT EXISTS (SELECT * FROM sysobjects WHERE name='Sensores' AND xtype='U')
BEGIN
    CREATE TABLE Sensores (
        id_sensor INT IDENTITY(1,1) PRIMARY KEY,
        id_invernadero INT NOT NULL FOREIGN KEY REFERENCES Invernaderos(id_invernadero),
        tipo NVARCHAR(50) NOT NULL,
        nombre NVARCHAR(200) NOT NULL,
        estado NVARCHAR(50) DEFAULT 'activo',
        ultimaLectura DECIMAL(10,2) DEFAULT 0,
        unidad NVARCHAR(20),
        umbralMin DECIMAL(10,2),
        umbralMax DECIMAL(10,2),
        ultimaActualizacion DATETIME DEFAULT GETDATE(),
        zonaRiegoId INT NULL FOREIGN KEY REFERENCES ZonasRiego(id_zona)
    );
END

-- LecturasSensores table
IF NOT EXISTS (SELECT * FROM sysobjects WHERE name='LecturasSensores' AND xtype='U')
BEGIN
    CREATE TABLE LecturasSensores (
        id_lectura INT IDENTITY(1,1) PRIMARY KEY,
        id_sensor INT NOT NULL FOREIGN KEY REFERENCES Sensores(id_sensor),
        valor DECIMAL(10,2) NOT NULL,
        unidad NVARCHAR(20),
        fecha_hora DATETIME DEFAULT GETDATE()
    );
END

-- Riegos table
IF NOT EXISTS (SELECT * FROM sysobjects WHERE name='Riegos' AND xtype='U')
BEGIN
    CREATE TABLE Riegos (
        id_riego INT IDENTITY(1,1) PRIMARY KEY,
        zonaRiegoId INT NOT NULL FOREIGN KEY REFERENCES ZonasRiego(id_zona),
        tipo NVARCHAR(50) NOT NULL,
        inicio DATETIME NOT NULL,
        fin DATETIME NULL,
        duracion INT DEFAULT 0,
        volumen DECIMAL(10,2) DEFAULT 0,
        estado NVARCHAR(50) DEFAULT 'completado'
    );
END

-- ConfiguracionesSistema table
IF NOT EXISTS (SELECT * FROM sysobjects WHERE name='ConfiguracionesSistema' AND xtype='U')
BEGIN
    CREATE TABLE ConfiguracionesSistema (
        id_config INT IDENTITY(1,1) PRIMARY KEY,
        id_empresa INT NOT NULL FOREIGN KEY REFERENCES Empresas(id_empresa),
        parametro NVARCHAR(200) NOT NULL,
        valor NVARCHAR(500),
        descripcion NVARCHAR(500),
        creado_por INT NULL FOREIGN KEY REFERENCES Usuarios(id_usuario),
        fecha_creacion DATETIME DEFAULT GETDATE()
    );
END

-- Alertas table
IF NOT EXISTS (SELECT * FROM sysobjects WHERE name='Alertas' AND xtype='U')
BEGIN
    CREATE TABLE Alertas (
        id_alerta INT IDENTITY(1,1) PRIMARY KEY,
        tipo NVARCHAR(50) NOT NULL,
        mensaje NVARCHAR(500) NOT NULL,
        sensorId INT NULL FOREIGN KEY REFERENCES Sensores(id_sensor),
        invernaderoId INT NULL FOREIGN KEY REFERENCES Invernaderos(id_invernadero),
        timestamp DATETIME DEFAULT GETDATE(),
        resuelta BIT DEFAULT 0
    );
END

-- Indexes for performance (optional but recommended)
CREATE INDEX IX_Usuarios_correo ON Usuarios(correo);
CREATE INDEX IX_Invernaderos_id_empresa ON Invernaderos(id_empresa);
CREATE INDEX IX_ZonasRiego_id_invernadero ON ZonasRiego(id_invernadero);
CREATE INDEX IX_Sensores_id_invernadero ON Sensores(id_invernadero);
CREATE INDEX IX_LecturasSensores_id_sensor ON LecturasSensores(id_sensor);
CREATE INDEX IX_Riegos_zonaRiegoId ON Riegos(zonaRiegoId);
CREATE INDEX IX_ConfiguracionesSistema_id_empresa ON ConfiguracionesSistema(id_empresa);
CREATE INDEX IX_Alertas_sensorId ON Alertas(sensorId);
CREATE INDEX IX_Alertas_invernaderoId ON Alertas(invernaderoId);

PRINT 'Migration 001_init applied successfully';