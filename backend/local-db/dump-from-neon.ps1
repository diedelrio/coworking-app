# Descarga un dump de la base de producción (Neon) a ./dump/prod.dump
# Uso:  $env:NEON_DATABASE_URL = "postgresql://...conexión DIRECTA (sin -pooler)..."
#       ./dump-from-neon.ps1
# Solo LEE de producción (pg_dump no modifica nada).
if (-not $env:NEON_DATABASE_URL) { throw "Definí `$env:NEON_DATABASE_URL con la conexión directa de Neon (sin '-pooler' en el host)." }
if ($env:NEON_DATABASE_URL -match '-pooler') { throw "Usá la conexión DIRECTA de Neon (el host no debe contener '-pooler')." }

$dump = Join-Path $PSScriptRoot 'dump'
New-Item -ItemType Directory -Force $dump | Out-Null

# pg_dump corre dentro de un contenedor: no necesitás instalar Postgres.
docker run --rm -e PGURL="$env:NEON_DATABASE_URL" -v "${dump}:/dump" postgres:17 `
  sh -c 'pg_dump "$PGURL" --format=custom --no-owner --no-acl --file=/dump/prod.dump'
if ($LASTEXITCODE -ne 0) { throw "pg_dump falló (si dice 'server version mismatch', avisame la versión de Postgres de Neon)." }
Write-Host "Dump listo: $dump\prod.dump"
