# Guía de despliegue — Dashboard Monteverdi P.H.

Arquitectura: **Vercel** (frontend) + **Railway** (backend Python + volumen persistente).
Una vez montado, los Excel nuevos se suben **desde la web** (botón "Subir Excel"),
sin carpetas ni Git. Funciona desde cualquier PC o celular.

```
Navegador (celular/PC) ──► Vercel (dashboard React)
                              │  VITE_API_URL
                              ▼
                           Railway (FastAPI + parsers)
                              │  DATA_ROOT = /data (volumen persistente)
                              ▼
                           Excel subidos vía /api/upload
```

---

## PASO 1 · GitHub (una sola vez, desde el PC que tiene el código)

1. Crea un repositorio **PRIVADO** en https://github.com/new
   - Nombre: `dashboard-monteverdi`
   - Visibilidad: **Private** (contiene datos personales — Ley 1581 habeas data)
   - NO agregues README
2. Conecta y sube (en una terminal dentro de `D:\DASHBOARD 2026`):
   ```
   git remote add origin https://github.com/TU-USUARIO/dashboard-monteverdi.git
   git push -u origin main
   ```
   (Windows abrirá el navegador para autorizar — es normal.)

Con esto **todo el código y los 28 Excel semilla quedan en GitHub**. El otro PC ya no
necesita el código local: Railway y Vercel despliegan directamente desde GitHub por web.

---

## PASO 2 · Railway — backend (desde cualquier PC, por web)

1. https://railway.app → **Login with GitHub**
2. **New Project → Deploy from GitHub repo** → autoriza → elige `dashboard-monteverdi`
3. **Agregar volumen persistente** (para que los Excel subidos sobrevivan):
   - En el servicio → pestaña **Volumes** → **New Volume**
   - Mount path: `/data`
4. **Variables** (pestaña Variables → New Variable):
   | Variable      | Valor                        |
   |---------------|------------------------------|
   | `DATA_ROOT`   | `/data`                      |
   | `CACHE_DIR`   | `/tmp/.cache`                |
   | `UPLOAD_KEY`  | *(inventa una clave secreta, ej. `Monteverdi2026!`)* |
5. **Settings → Networking → Generate Domain** → copia la URL
   (ej. `https://dashboard-monteverdi-production.up.railway.app`)
6. Verifica en el navegador: `TU-URL/api/health` → debe responder `{"status":"ok"}`

> En el primer arranque, el backend copia los 28 Excel semilla del repo al volumen `/data`.
> A partir de ahí, cada archivo que subas por la web queda guardado en el volumen para siempre.

💰 Railway: crédito de prueba gratis; luego plan Hobby ≈ US$5/mes.

---

## PASO 3 · Vercel — frontend (desde cualquier PC, por web)

1. https://vercel.com → **Login with GitHub**
2. **Add New → Project** → importa `dashboard-monteverdi`
3. **Root Directory**: `frontend`  ⚠️ (importante)
4. **Environment Variables**:
   | Variable        | Valor                                    |
   |-----------------|------------------------------------------|
   | `VITE_API_URL`  | la URL de Railway del paso 2 (sin `/` al final) |
5. **Deploy** → en ~2 min tendrás la URL pública (ej. `https://dashboard-monteverdi.vercel.app`)
6. Ábrela desde el celular ✅

---

## PASO 4 · Colaboradores (GitHub)

Repo → **Settings → Collaborators → Add people** → invita por usuario o correo.
Cada colaborador puede clonar, crear ramas y abrir Pull Requests. Cada PR genera
automáticamente una **URL de vista previa** en Vercel.

---

## USO MENSUAL (desde cualquier PC o celular, sin carpetas)

1. Abre el dashboard en el navegador.
2. Botón **"Subir Excel"** (arriba, junto al de refrescar).
3. La primera vez pide la **clave de carga** (`UPLOAD_KEY`) — el navegador la recuerda.
4. Eliges el/los `.xls` nuevos (informe del mes, cartera, recaudo).
5. En segundos el dashboard muestra el mes nuevo. Los parsers lo detectan por el
   nombre del archivo (ej. `06-2026-INFORMES FINANCIEROS JUNIO...xls`).

> Conserva el patrón de nombres habitual del contador. No hay que tocar nada más.

---

## Seguridad — pendiente recomendado

El dashboard queda accesible para cualquiera con la URL. Antes de compartirla al
consejo, conviene agregar una **pantalla de clave de acceso** (10 min de trabajo)
o usar **Cloudflare Access** (login por correo, gratis hasta 50 usuarios).
La carga de archivos ya está protegida con `UPLOAD_KEY`; esto protegería además la lectura.
