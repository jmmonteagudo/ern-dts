# Ern — ABAP Cloud Module

PoC ABAP RAP corriendo en SAP BTP ABAP Environment Trial (`bv-arc`), conectado al pipeline CI/CD.

## Sistema

| | |
|---|---|
| Service instance | `default_abap-trial` (org `392727e0trial` / space `dev`) |
| Plan | `abap-trial / shared` (gratis, suspende inactivo) |
| System ID | `TRL` |
| Fiori Launchpad | https://e9233ee0-105b-4c71-893f-d4b6f0ddd36a.abap-web.us10.hana.ondemand.com/ui |
| ADT endpoint | https://e9233ee0-105b-4c71-893f-d4b6f0ddd36a.abap.us10.hana.ondemand.com |

> **Trial limit:** se suspende cada 4-8 horas de inactividad. Re-iniciar desde Cockpit → Service Instances → `default_abap-trial` → Start.

> **Nota histórica:** existió otro instance `bv-arc` creado vía API, pero fue borrado porque no permitía bootstrap admin (creator distinto). El instance correcto es `default_abap-trial`, creado por el booster con SSO del user actual.

## Setup local — Eclipse + ADT (recomendado)

ADT es el IDE oficial SAP para ABAP. Funciona en Eclipse local mucho mejor que en BAS para esta demo.

### 1. Instalar Eclipse

```
brew install --cask eclipse-java   # macOS
# o descarga: https://www.eclipse.org/downloads/packages/
```

### 2. Instalar ABAP Development Tools

Eclipse → Help → Install New Software → Add:
- Name: `ABAP Tools`
- Location: `https://tools.hana.ondemand.com/latest`

Selecciona **ABAP Development Tools**, instala, reinicia.

### 3. Conectar al sistema bv-arc

1. Eclipse → File → New → ABAP Cloud Project
2. Selecciona **SAP BTP, ABAP environment** → Service Key
3. Pega el JSON del service key:
   ```
   cf service-key default_abap-trial dev-key
   ```
4. Login OAuth en navegador → done

### 4. Crear paquete propio

ABAP system → tu user (ej. `CB9980000XXX`) → Right-click → New → ABAP Package
- Name: `ZERN_PRODUCTS`
- Description: `Ern PoC — Product Service`
- Software Component: `ZLOCAL` (default trial)
- Transport: `(local)` o crea uno

### 5. Conectar paquete a Git

ABAP system → Right-click `ZERN_PRODUCTS` → **Link to Git Repository**
- Repository URL: `https://github.com/jmmonteagudo/ern.git`
- Branch: `main`
- Folder logic: `PREFIX`
- Starting folder: `/abap/src/`

abapGit hará checkout, leerá `.abapgit.xml` y solo verá objetos bajo `abap/src/`.

## Setup BAS (alternativa, si no quieres Eclipse)

> ADT en BAS no está disponible directamente. La opción es:

1. BTP Cockpit → Boosters → "Get Started with SAP Build Code"
2. Crear dev space tipo **"SAP Fiori"** (NO Full Stack — el de Fiori incluye ABAP RAP project wizard)
3. New Project → "ABAP RAP" → conectar al sistema ABAP via service key

Limitación: BAS para ABAP es menos completo que Eclipse+ADT. Recomiendo Eclipse.

## Estructura

```
abap/
├── .abapgit.xml          # Config abapGit (folder logic, ignore)
├── README.md             # Este archivo
└── src/                  # Aquí abapGit serializa los objetos ABAP
    └── (auto-populated por abapGit cuando creas/modificas objetos)
```

abapGit convierte cada objeto ABAP en archivos XML/ABAP serializados. Tú escribes en ADT, abapGit serializa, push a Git.

## Próximo objeto a crear (en ADT)

Empezar con un servicio OData mínimo:

1. **Database Table** `ZERN_PRODUCTS`
   - Fields: `client`, `product_id` (key), `name`, `category`, `stock`, `price`
2. **CDS View Entity** `ZI_ERN_PRODUCT`
   - Lectura sobre la tabla, anotaciones UI básicas
3. **Behavior Definition** `ZI_ERN_PRODUCT` (managed)
4. **Service Definition** `ZUI_ERN_PRODUCT_O4`
5. **Service Binding** `ZUI_ERN_PRODUCT_O4` → OData v4, UI

Después de crear cada uno: `Right-click → Project Explorer → Stage and Push to Git`.

## Pipeline CI/CD

Job `test-abap` en `.github/workflows/ci-cd.yml` ejecuta:
1. Pull del repo Git al sistema ABAP via API (Software Components)
2. Trigger ATC run (ABAP Test Cockpit) sobre paquete `ZERN_PRODUCTS`
3. Fail si findings prio 1-2

Secrets necesarios en GitHub:
- `ABAP_HOST` — `https://e9233ee0-105b-4c71-893f-d4b6f0ddd36a.abap.us10.hana.ondemand.com`
- `ABAP_UAA_URL` — `https://392727e0trial.authentication.us10.hana.ondemand.com`
- `ABAP_CLIENT_ID`, `ABAP_CLIENT_SECRET` — del campo `uaa.clientid` / `uaa.clientsecret` de la service key
- (Generables con `cf service-key default_abap-trial dev-key`)

> **Nota plan trial:** el grant `client_credentials` no autoriza ATC API en plan `shared` (devuelve HTTP 401). El step `test-abap` en el pipeline está gated por `vars.ABAP_ENABLED == 'true'` precisamente por esto. Para activar realmente, hay que pasar a plan `standard` (paid).
