# Flujo operativo y simulación de roles

## Flujo único de una pieza

```text
Borrador → Enviar a cliente → Aprobada / Ajustes → Producción → Edición
→ Revisión final → Lista para publicar → Publicada → Métricas
```

No se salta ninguna puerta: `Publicaciones` solo recibe piezas `ready_to_publish` o `published`.

## Colas visibles

| Cola | Quién actúa | Estados |
| --- | --- | --- |
| Ideas | Owner y creativa | Todos |
| Aprobaciones | Owner + cliente | `pending_approval`, `needs_changes`, `ready_to_publish` |
| Producción | Cámara, modelo, editor | `approved`, `in_production`, `editing`, `ready_to_publish` |
| Publicaciones | Publisher + pauta | `ready_to_publish`, `published` |
| Métricas | Pauta + owner | `published` |

## Matriz de simulación antes de OAuth

| Rol simulado | Puede decidir | Debe ver primero | Caso de prueba |
| --- | --- | --- | --- |
| Owner | Crear, enviar, asignar, revisar | Bloqueos y aprobación | Envía O1 al cliente |
| Cliente | Aprobar / ajustes | Referencia, concepto y versión | Pide ajustes a O4 |
| Cámara | Marcar rodaje y cargar media | Referencia, planos, luz y locación | Prepara O3 |
| Modelo | Confirmar preparación | Vestuario, actitud, movimiento | Confirma O6 |
| Editor | Subir versiones y resolver comentarios | Hook, ritmo, textos, formatos | Entrega V1 de O8 |
| Pauta | Programar y registrar resultado | Audiencia, CTA, copy y plataforma | Programa P1 cuando llegue a revisión final |
| Publisher | Registrar URL de salida | Copy final y fecha | Publica solo después de `ready_to_publish` |

## Funcionalidades de siguiente nivel

Las siguientes piezas se priorizaron por prácticas de revisión audiovisual: comentarios con contexto temporal, versiones no destructivas, aprobaciones por etapas y responsables nombrados. Frame.io concentra review/versioning/comentarios de video y Adobe Workfront plantea workflows escalonados, con responsables y auditoría de aprobación. [Frame.io](https://frame.io/capture-review-deliver) · [Adobe Workfront](https://business.adobe.com/products/workfront/proofing-approvals.html)

1. Comentarios anclados a segundo/fotograma cuando el asset sea video.
2. Comparador V1/V2 para cliente y editor.
3. Checklist de rodaje por escena y responsable.
4. Fechas límite, recordatorios y escalamiento de aprobación vencida.
5. Plantillas de brief por tipo de contenido (orgánico, pauta, catálogo, creator).
6. Registro de decisión con actor, fecha, versión y comentario obligatorio.
