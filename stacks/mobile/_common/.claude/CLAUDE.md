# Categoría: MOBILE — playbook senior (común a todo móvil)

## Arquitectura
- Pantallas/componentes pequeños; lógica en hooks/servicios/repositories. **Navegación tipada** y centralizada.
- Server-state separado del estado de UI. **Offline-first** cuando aplique: cache local como fuente, sincronización en background.
- Tipado strict en toda la base.

## Particularidades móviles (donde se cae el frontend web ingenuo)
- **Offline y red inestable**: maneja pérdida de conexión, reintentos con backoff y resolución de conflictos al sincronizar. Estados explícitos de "sin conexión".
- **Rendimiento**: listas **virtualizadas** para datos largos; nada de trabajo pesado en el hilo de UI (jank). Imágenes dimensionadas y cacheadas.
- **Ciclo de vida**: la app se suspende/reanuda; libera recursos, pausa timers/streams, reanuda estado correctamente.
- **Permisos** (cámara, ubicación, notificaciones, fotos): pídelos en contexto, justifícalos, y **degrada con elegancia** si se niegan.
- **Layout**: respeta safe areas, notches, distintos tamaños/densidades y orientación. Touch targets ≥ 44px.
- **Accesibilidad del SO**: lectores de pantalla, dynamic type/escala de fuente, contraste.

## Seguridad
- Tokens/secrets en almacenamiento **seguro del dispositivo** (Keychain/Keystore), nunca en storage plano.
- Solo claves públicas en el cliente. Certificate pinning en APIs sensibles si procede. Ofusca lo justo; asume que el binario es inspeccionable.

## Distribución
- Versionado y releases por tienda (App Store / Play). OTA updates con cuidado de compatibilidad de esquema/estado y rollback.

## Agentes/skills recomendados (los instala el kit)
Agentes: `frontend-developer`, `ui-ux-designer`. Skills: `frontend-design`, `ui-design-system`, `clean-code`.
