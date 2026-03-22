# Módulo Comercial: Tarifas, Bonos, Promociones y Contratos
Sistema Coworking Sinergia

Versión: 1.0  
Estado: Propuesta funcional y técnica  
Autor: Equipo de Producto  

---

# 1. Introducción

El sistema actual de reservas permite gestionar espacios, usuarios y reservas.  
Sin embargo, el modelo de negocio del coworking requiere administrar estructuras comerciales más complejas que incluyen:

- tarifas por uso (hora, día, media jornada)
- planes mensuales
- bonos de horas o días
- promociones temporales
- condiciones comerciales especiales
- contratos personalizados con clientes
- saldos de uso disponibles para cada usuario

Para soportar estos escenarios se propone la incorporación de un **módulo comercial completo**, que permita administrar el catálogo de productos, contratos, promociones y el consumo de beneficios dentro del sistema de reservas.

---

# 2. Objetivos del módulo

El objetivo del módulo comercial es permitir:

1. Gestionar el **catálogo de tarifas, planes y bonos**.
2. Definir **promociones comerciales**.
3. Administrar **contratos con clientes**.
4. Asignar **beneficios o créditos de uso**.
5. Controlar el **consumo de horas o días disponibles**.
6. Permitir a los usuarios consultar **planes contratados y saldos disponibles**.
7. Mantener trazabilidad del **precio aplicado en cada reserva**.

---

# 3. Conceptos del modelo comercial

El módulo introduce los siguientes conceptos principales.

---

## 3.1 Producto comercial

Representa un servicio que el coworking ofrece a sus clientes.

Ejemplos:

- Coworking Premium mensual
- Coworking por día
- Coworking por hora
- Sala de reuniones por hora
- Sala Inspiración jornada completa
- Bono de 4 horas de sala de reuniones

Un producto comercial define:

- nombre
- descripción
- tipo de producto
- espacio aplicable
- modalidad de cobro
- precio base
- vigencia
- impuestos aplicables

Tipos de producto:

- PLAN (servicio recurrente)
- BONO (prepago de uso)
- TARIFA (pago por uso)

---

## 3.2 Tarifa

Una tarifa define el **precio estándar de un servicio**.

Ejemplos:

- Sala reuniones → 12 €/hora
- Coworking → 6 €/hora
- Sala Inspiración → 42 €/día

Las tarifas son el **precio base del sistema**, pero pueden ser modificadas por:

- contratos
- promociones
- beneficios

---

## 3.3 Contrato

Un contrato representa el acuerdo comercial entre el coworking y un cliente.

Permite registrar:

- duración del contrato
- espacio contratado
- precio acordado
- forma de pago
- condiciones especiales

Un contrato puede incluir varias líneas de servicio.

Ejemplo:

Contrato cliente empresa:

- Coworking Premium mensual
- 1 puesto fijo
- precio acordado 130 €/mes
- pago por transferencia
- vigencia 6 meses

---

## 3.4 Línea de contrato

Cada contrato puede contener varias líneas que definen los servicios incluidos.

Ejemplos:

- acceso coworking mensual
- acceso sala inspiración
- bono de reuniones
- descuento especial

Cada línea puede tener:

- precio de lista
- precio acordado
- descuento aplicado
- periodo de vigencia

---

## 3.5 Promociones

Las promociones permiten ofrecer condiciones especiales de forma temporal.

Tipos de promoción soportados:

### Precio especial

Ejemplo:

Sala reuniones a 9 €/hora durante abril.

---

### Descuento porcentual

Ejemplo:

20% de descuento en coworking para nuevos clientes.

---

### Bono promocional

Ejemplo:

Compra 4 horas de sala y recibe 1 hora adicional.

---

Las promociones pueden aplicarse a:

- productos
- espacios
- segmentos de usuarios
- contratos específicos

---

## 3.6 Beneficios y créditos

Algunos planes o bonos generan **créditos de uso**.

Ejemplos:

- Coworking Premium incluye 3 horas de sala reuniones al mes
- Bono reuniones 4 horas

Estos créditos se almacenan como **saldo disponible del usuario**.

Cuando se realiza una reserva, el sistema puede:

- consumir saldo disponible
- aplicar tarifa
- aplicar promoción

---

## 3.7 Consumo de beneficios

Cada vez que una reserva utiliza horas o días incluidos en un bono o plan, el sistema registra un consumo.

Esto permite conocer:

- saldo restante
- historial de uso
- origen del crédito

---

# 4. Lógica de aplicación de precios

Cuando se crea una reserva, el sistema determina el precio siguiendo el siguiente orden:

1. contrato activo del usuario
2. beneficio o bono disponible
3. promoción vigente
4. tarifa estándar

Este orden asegura que:

- se respeten acuerdos comerciales
- se utilicen bonos disponibles
- se apliquen promociones si corresponden
- en último caso se aplique tarifa normal

---

# 5. Funcionalidades para administradores

Los administradores del sistema podrán operar el módulo comercial desde el panel de administración.

Las funcionalidades incluyen:

- gestión de tarifas
- gestión de bonos
- gestión de promociones
- gestión de contratos
- asignación de productos a usuarios
- consulta de saldos y consumos

---

# 6. Operación del módulo por administradores

---

## 6.1 Gestión del catálogo comercial

Ruta:

Admin → Comercial → Tarifas y Bonos

El administrador podrá:

- crear nuevas tarifas
- crear bonos de uso
- modificar precios
- activar o desactivar productos
- definir vigencias

Ejemplo de uso:

Crear producto:

Sala reuniones por hora  
Precio: 12 €/hora  
Tipo: tarifa  
Espacio: sala reuniones

---

## 6.2 Creación de promociones

Ruta:

Admin → Comercial → Promociones

El administrador puede:

- crear promociones
- definir periodo de vigencia
- seleccionar productos afectados
- definir tipo de promoción

Tipos disponibles:

- precio especial
- descuento porcentual
- bono adicional

Ejemplo:

Promoción primavera  
20% descuento en coworking  
vigente del 1 al 30 de abril

---

## 6.3 Gestión de contratos

Ruta:

Admin → Comercial → Contratos

Un contrato se crea asociándolo a un cliente.

El administrador deberá indicar:

- cliente
- fecha inicio
- fecha fin
- forma de pago
- condiciones especiales

Luego se agregan las líneas del contrato.

Ejemplo:

Cliente: Empresa XYZ  
Duración: 6 meses  
Pago: transferencia mensual

Líneas:

- Coworking Premium  
- precio acordado 130 €/mes

---

## 6.4 Asignación de bonos

Ruta:

Admin → Usuarios → Productos

El administrador puede asignar a un usuario:

- un plan
- un bono
- una promoción especial

Esto generará automáticamente el saldo correspondiente.

Ejemplo:

Asignar bono reuniones 4h.

El sistema genera:

Saldo reuniones: 4 horas.

---

## 6.5 Consulta de saldos

Ruta:

Admin → Comercial → Saldos

El administrador puede ver:

- saldo disponible por usuario
- origen del saldo
- fecha de expiración
- historial de consumo

---

# 7. Operación del módulo por usuarios finales

Los usuarios finales podrán consultar y gestionar sus servicios desde el panel de usuario.

---

## 7.1 Consulta de productos contratados

Ruta:

Panel usuario → Mis planes

El usuario podrá ver:

- planes activos
- bonos disponibles
- fecha de vencimiento
- condiciones del servicio

Ejemplo:

Coworking Premium  
Activo hasta 30/06  
Incluye 3 horas de sala reuniones

---

## 7.2 Consulta de saldos

Ruta:

Panel usuario → Mis bonos

El usuario podrá ver:

- horas disponibles
- días disponibles
- fecha de expiración

Ejemplo:

Sala reuniones  
Saldo disponible: 2 horas

---

## 7.3 Compra de bonos

Ruta:

Panel usuario → Comprar bonos

El usuario podrá adquirir bonos disponibles en el catálogo.

Ejemplo:

Bono sala reuniones 4 horas  
Precio: 28 €

Una vez comprado:

El sistema genera saldo de 4 horas.

---

## 7.4 Uso de bonos en reservas

Cuando el usuario realiza una reserva, el sistema verifica automáticamente:

- si existe saldo disponible
- si existe promoción aplicable

Si hay saldo suficiente:

La reserva consumirá el bono correspondiente.

Si no hay saldo:

Se aplicará la tarifa estándar.

---

# 8. Historial de consumo

El sistema mantiene registro de:

- reservas realizadas
- créditos utilizados
- precio aplicado
- promociones utilizadas

Esto permite auditoría completa del sistema.

---

# 9. Impacto en el sistema de reservas

El flujo de reservas se mantiene igual para el usuario, pero el sistema agrega lógica de pricing.

Cuando se crea una reserva:

1. el sistema analiza productos del usuario
2. verifica promociones vigentes
3. determina el precio aplicable
4. registra un snapshot del cálculo

Este snapshot permite reconstruir el cálculo incluso si las tarifas cambian posteriormente.

---

# 10. Beneficios del nuevo módulo

La implementación del módulo comercial permite:

- gestionar contratos personalizados
- aplicar promociones comerciales
- administrar bonos de uso
- controlar consumos
- mantener trazabilidad de precios
- soportar crecimiento del negocio

---

# 11. Futuras mejoras

Posibles extensiones del módulo:

- facturación automática
- renovación automática de contratos
- integración con pagos online
- segmentación de clientes
- campañas promocionales
- reglas avanzadas de pricing

---

# 12. Conclusión

El módulo comercial introduce una capa de gestión que permite representar correctamente el modelo de negocio del coworking.

Permite administrar:

- tarifas
- bonos
- promociones
- contratos
- beneficios
- consumos

De esta forma el sistema podrá soportar tanto tarifas públicas como acuerdos comerciales personalizados, manteniendo control y trazabilidad en todas las operaciones.