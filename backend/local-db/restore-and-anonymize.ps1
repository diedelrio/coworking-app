# Levanta Postgres en Docker, restaura ./dump/prod.dump y anonimiza los datos.
# Se puede repetir las veces que quieras: recrea la base desde cero.
Set-Location $PSScriptRoot
if (-not (Test-Path ./dump/prod.dump)) { throw "Falta ./dump/prod.dump. Ejecutá primero ./dump-from-neon.ps1" }

docker compose up -d --wait db
if ($LASTEXITCODE -ne 0) { throw "No se pudo levantar el contenedor." }

docker compose exec -T db psql -U coworking -d postgres -v ON_ERROR_STOP=1 -c "DROP DATABASE IF EXISTS coworking WITH (FORCE);" -c "CREATE DATABASE coworking;"
if ($LASTEXITCODE -ne 0) { throw "No se pudo recrear la base." }

# pg_restore puede mostrar avisos de extensiones propias de Neon: son inofensivos.
docker compose exec -T db pg_restore -U coworking -d coworking --no-owner --no-acl /dump/prod.dump
Write-Host "Restore terminado (exit $LASTEXITCODE; avisos de extensiones son normales)."

docker compose exec -T db psql -U coworking -d coworking -v ON_ERROR_STOP=1 -f /anonymize.sql
if ($LASTEXITCODE -ne 0) { throw "La anonimización falló: NO uses esta base hasta que se resuelva." }

Write-Host "Listo. Usuarios: admin<id>@example.test / user<id>@example.test  -  contraseña: Test1234!"
