Estados de las reservas.

stateDiagram
    
    [inicio]  --> ACTIVE: Creación de reserva por usuario con rol ADMIN o usuario con rol CLIENT y UserClassify= GOOD 
    [inicio]  --> PENDING: Creación de reserva por usuario rol CLIENT y UserClassify REGULAR, BAD O NULO.
    
    PENDING   --> ACTIVE: usuario con rol ADMIN aprueba
    PENDING   --> REJECTED: usuario con rol ADMIN rechaza
    
    ACTIVE    --> CANCELLED: usuario con rol ADMIN o usuario con rol CLIENT solicita cancelación
    ACTIVE    --> COMPLETED: Se cumplen las horas de reserva
    ACTIVE    --> PENALIZED: El usuario con rol CLIENT solicita la Cancelación con poca anticipación y el usuario con rol ADMIN cambia y penaliza
    
    COMPLETED --> INVOICED: Se marca como facturada al cliente
    PENALIZED --> INVOICED: Se penaliza y se marca como facturada al cliente
    
    REJECTED  --> ACTIVE: cuando el usuario con rol ADMIN rechaza, solo este tiene la potestad de reactivar
    REJECTED  --> [final]

    CANCELLED --> ACTIVE: cuando el usuario con rol ADMIN rechaza, solo este tiene la potestad de reactivar    
    CANCELLED --> [final]
    
    INVOICED  --> [final]

stateDiagram-v2
    state "Punto de Decisión" as Choice <<choice>>

    [*] --> Choice
    
    Choice --> ACTIVE : Rol ADMIN o CLIENT (GOOD)
    Choice --> PENDING : Rol CLIENT (REGULAR, BAD o NULL)

    PENDING --> ACTIVE : Admin Aprueba
    PENDING --> REJECTED : Admin Rechaza

    ACTIVE --> CANCELLED : Admin o Client cancela
    ACTIVE --> COMPLETED : Tiempo cumplido
    ACTIVE --> PENALIZED : Cancelación tardía (Acción Admin)

    COMPLETED --> INVOICED : Facturación
    PENALIZED --> INVOICED : Facturación

    REJECTED --> ACTIVE : Reactivación (Solo ADMIN)
    REJECTED --> [*]

    CANCELLED --> ACTIVE : Reactivación (Solo ADMIN)
    CANCELLED --> [*]

    INVOICED --> [*]