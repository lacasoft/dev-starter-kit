# Stack: React Native — playbook senior (Expo / TypeScript)

## Base
- Componentes funcionales + hooks. TypeScript strict. Hermes como engine.
- **Navegación tipada** con React Navigation (o expo-router): tipa rutas y params; nada de strings sueltos.

## Estado y datos
- Server-state con **TanStack Query**; persistencia/offline con `react-query-persist` + **MMKV** (rápido) o SQLite para datos relacionales.
- Client-state con Zustand/Context. Deriva, no dupliques.

## Rendimiento (lo que diferencia una app fluida)
- Listas largas con **FlashList** (o `FlatList` bien configurada): `keyExtractor` estable, `getItemLayout` cuando se pueda, `windowSize`/`removeClippedSubviews`. Evita renders innecesarios (`React.memo`, selectores).
- Animaciones y gestos con **react-native-reanimated** + gesture-handler: corren en el hilo de UI (worklets), no bloquean JS. Nada de animar en el hilo JS.
- Imágenes con `expo-image` (cache). Evita trabajo síncrono pesado en el render.

## Plataforma y seguridad
- Diferencias iOS/Android explícitas (`Platform.select`). Safe areas con `react-native-safe-area-context`.
- Secrets en `expo-secure-store` / Keychain-Keystore; **nunca** AsyncStorage para tokens.
- Permisos con los módulos de Expo; maneja el caso "denegado".

## Calidad
- `npx react-doctor .` incluye reglas específicas de React Native (perf, listas, efectos).

## Comandos
- `npx expo start` · `npm run android` · `npm run ios` · `npm run lint`
- `npm test` (Jest + @testing-library/react-native)

## Tests
- Jest + Testing Library RN: comportamiento, no implementación. Mockea módulos nativos. Detox para e2e si el flujo lo amerita.
