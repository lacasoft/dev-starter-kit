# Stack: Solidity — playbook senior (Foundry)

## Seguridad primero (el código es dinero, es inmutable, es público)
- **Checks-Effects-Interactions** en toda función que llame a externos. `ReentrancyGuard` donde haya llamada externa + cambio de estado. Cuidado con reentrancy **cross-function** y de solo-lectura.
- Auth con `msg.sender` (**nunca** `tx.origin`). Aleatoriedad: nunca `block.timestamp`/`blockhash` (usa VRF). Cuidado con front-running/MEV (commit-reveal, slippage).
- Control de acceso explícito (`Ownable`/`AccessControl`); deniega por defecto. Valida todos los inputs. **Pull over push** para pagos. `delegatecall` solo con extremo cuidado (colisión de storage).
- Reutiliza primitivas **auditadas** (OpenZeppelin); no reinventes criptografía ni estándares (ERC-20/721/1155).

## Calidad y verificación
- Tests con **Forge**: unitarios, **fuzzing** (`forge test` con inputs aleatorios) e **invariantes/handlers** para propiedades del sistema. Cobertura con `forge coverage`.
- Análisis estático con **Slither**; revisa cada hallazgo. Considera Echidna/Foundry invariants para propiedades críticas.
- Gas: optimiza **solo con medición** (`forge snapshot`); no sacrifiques claridad/seguridad por micro-gas.

## Upgradeabilidad y despliegue
- Si hay proxies: patrón **UUPS** (o Transparent) con cuidado de **storage layout** (gaps, orden inmutable entre versiones). Inicializadores, no constructores, y protégelos.
- Despliegue con scripts de Forge (`forge script`) + verificación en el explorador. Multisig/timelock para funciones de administración.

## Estilo
- Contratos pequeños y enfocados. **Eventos** en cada cambio de estado relevante. NatSpec documentando invariantes y supuestos de seguridad. `forge fmt`.

## Comandos
- `forge build` · `forge test -vvv` · `forge fmt` · `forge coverage` · `forge snapshot`
- `slither .`
- `forge script script/Deploy.s.sol --rpc-url <env> --broadcast --verify`
