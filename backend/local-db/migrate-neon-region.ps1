# Copia TODA la base de un proyecto de Neon a otro (p.ej. para cambiar de región).
# Solo LEE del origen (pg_dump); escribe únicamente en el destino, que debe estar vacío.
#
# Uso (PowerShell, en backend/local-db):
#   $env:OLD_DATABASE_URL = "<conexión DIRECTA del proyecto actual>"    # host SIN '-pooler'
#   $env:NEW_DATABASE_URL = "<conexión DIRECTA del proyecto nuevo>"     # host SIN '-pooler'
#   ./migrate-neon-region.ps1
#
# Las URLs se leen de variables de entorno: no las pegues en chats ni las guardes en archivos.
# Requiere Docker (pg_dump/pg_restore/psql corren en contenedores postgres:17).
param([switch]$AllowNonEmptyTarget)

$ErrorActionPreference = 'Stop'
$old = $env:OLD_DATABASE_URL
$new = $env:NEW_DATABASE_URL
if (-not $old -or -not $new) { throw "Definí `$env:OLD_DATABASE_URL y `$env:NEW_DATABASE_URL (conexiones directas, sin '-pooler')." }
if ($old -match '-pooler' -or $new -match '-pooler') { throw "Usá conexiones DIRECTAS: el host no debe contener '-pooler'." }
if ($old -eq $new) { throw "El origen y el destino son la misma base." }

$dumpDir = Join-Path $PSScriptRoot 'dump'
New-Item -ItemType Directory -Force $dumpDir | Out-Null
$dumpFile = Join-Path $dumpDir 'migrate.dump'

# Una consulta que devuelve "tabla|filas" para todas las tablas del esquema public
$countSql = @'
select table_name || '|' || (xpath('/row/c/text()', query_to_xml(format('select count(*) as c from %I.%I', table_schema, table_name), false, true, '')))[1]::text
from information_schema.tables where table_schema = 'public' and table_type = 'BASE TABLE' order by 1
'@

# El SQL se pasa por entrada estándar (PowerShell 5.1 pierde las comillas internas al llamar a docker).
function Invoke-Psql([string]$url, [string]$sql) {
  $out = $sql | docker run -i --rm -e PGURL="$url" postgres:17 sh -c 'psql $PGURL -At -v ON_ERROR_STOP=1'
  if ($LASTEXITCODE -ne 0) { throw "psql falló." }
  return @($out | Where-Object { $_ -ne '' })
}

Write-Host "1/5 Comprobando el destino..."
$targetTables = [int](@(Invoke-Psql $new "select count(*) from information_schema.tables where table_schema = 'public'")[0])
if ($targetTables -gt 0 -and -not $AllowNonEmptyTarget) {
  throw "El destino ya tiene tablas. Usá un proyecto/base vacío (o -AllowNonEmptyTarget si sabés lo que hacés)."
}

Write-Host "2/5 Contando filas del origen..."
$before = @(Invoke-Psql $old $countSql)

Write-Host "3/5 Volcando el origen (solo lectura)..."
docker run --rm -e PGURL="$old" -v "${dumpDir}:/dump" postgres:17 sh -c 'pg_dump $PGURL --format=custom --no-owner --no-acl --file=/dump/migrate.dump'
if ($LASTEXITCODE -ne 0) { throw "pg_dump falló (si dice 'server version mismatch', avisá la versión de Postgres)." }

Write-Host "4/5 Restaurando en el destino..."
# Pueden aparecer avisos sobre extensiones propias de Neon: son inofensivos si el paso 5 da OK.
docker run --rm -e PGURL="$new" -v "${dumpDir}:/dump" postgres:17 sh -c 'pg_restore --no-owner --no-acl -d $PGURL /dump/migrate.dump'
Write-Host "   pg_restore terminó (exit $LASTEXITCODE)."

Write-Host "5/5 Comparando filas por tabla..."
$after = @(Invoke-Psql $new $countSql)
$diff = Compare-Object $before $after
if ($diff -or -not $before.Count) {
  Write-Host "DIFERENCIAS (<= origen, => destino):" -ForegroundColor Red
  $diff | Format-Table -AutoSize
  throw "La copia NO coincide con el origen. No cambies DATABASE_URL."
}
Write-Host ("OK: {0} tablas, mismas filas en origen y destino." -f $before.Count) -ForegroundColor Green
$before | ForEach-Object { Write-Host "   $_" }
Write-Host "El dump quedó en $dumpFile (contiene datos reales): borralo cuando termines."
