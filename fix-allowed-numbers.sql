-- Verificar las configuraciones actuales
SELECT id, enabled, "allowedPhoneNumbers" FROM ai_configurations;

-- Actualizar todas las configuraciones que tengan allowedPhoneNumbers como NULL
UPDATE ai_configurations 
SET "allowedPhoneNumbers" = ARRAY[]::text[]
WHERE "allowedPhoneNumbers" IS NULL;

-- Verificar el resultado
SELECT id, enabled, "allowedPhoneNumbers" FROM ai_configurations;
