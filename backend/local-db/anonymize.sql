-- Anonimiza la copia local de producción. Se ejecuta automáticamente tras restaurar.
-- Contraseña de TODOS los usuarios: Test1234!
BEGIN;

UPDATE "User" SET
  email = CASE WHEN role = 'ADMIN' THEN 'admin' || id || '@example.test' ELSE 'user' || id || '@example.test' END,
  name = CASE WHEN role = 'ADMIN' THEN 'Admin' ELSE 'Usuario' END,
  "lastName" = 'Demo' || id,
  "maternalLastName" = NULL,
  phone = NULL,
  password = '$2b$10$8GMmfMteVmXtie6c3PU.lOdCfX9CZ9RDa0OoOIMhk7l9hszl6Tfce';

DELETE FROM "PasswordResetToken";
DELETE FROM "ActivationToken";
DELETE FROM "UserHistory";                       -- contiene valores antiguos de email/teléfono
UPDATE "UserConsentAcceptance" SET "ipAddress" = NULL, "userAgent" = NULL;
UPDATE "Reservation" SET notes = NULL;
UPDATE "ProcessRun" SET "inputFileName" = NULL, "resultSummary" = NULL, "errorSummary" = NULL;
-- Settings que guardan emails (destinatarios de alertas, etc.)
UPDATE "Setting" SET value = 'alertas@example.test' WHERE value ~ '^[^ ]+@[^ ]+$';
UPDATE "SettingHistory" SET "oldValue" = NULL, "newValue" = '';

COMMIT;
