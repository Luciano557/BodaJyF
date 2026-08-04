# Configuración de Spotify en Vercel

La integración ya está incluida en el sitio. Las credenciales se cargan únicamente como variables protegidas de Vercel y nunca dentro de `index.html`.

## 1. Regenerar el Client Secret

El Secret anterior fue compartido en una conversación, por lo que debe considerarse expuesto.

1. Abrir el [Spotify Developer Dashboard](https://developer.spotify.com/dashboard).
2. Entrar en la aplicación **Boda Julián y Fiorella**.
3. Abrir **Settings**.
4. Regenerar o rotar el Client Secret.
5. No copiar el nuevo Secret en chats, documentos públicos ni archivos del sitio.

## 2. Confirmar la Redirect URI

En **Settings → Redirect URIs** debe estar exactamente:

```text
https://julianyfiorella.vercel.app/api/spotify-callback
```

## 3. Cargar las variables iniciales en Vercel

En el proyecto de Vercel, abrir **Settings → Environment Variables** y crear:

```text
SPOTIFY_CLIENT_ID=<Client ID de la aplicación>
SPOTIFY_CLIENT_SECRET=<nuevo Client Secret>
SPOTIFY_REDIRECT_URI=https://julianyfiorella.vercel.app/api/spotify-callback
SPOTIFY_PLAYLIST_ID=4RN43fmkIW50QtNEKMRZOY
SPOTIFY_SETUP_KEY=<una contraseña larga y exclusiva>
SITE_ORIGIN=https://julianyfiorella.vercel.app
```

Aplicarlas a **Production**, **Preview** y **Development** si se van a probar también previews. Después, hacer un redeploy.

## 4. Autorizar la cuenta propietaria

1. Abrir `https://julianyfiorella.vercel.app/api/spotify-authorize`.
2. Ingresar el valor elegido para `SPOTIFY_SETUP_KEY`.
3. Iniciar sesión en Spotify con la cuenta propietaria de la playlist.
4. Aceptar los permisos.
5. Copiar el refresh token que muestra la pantalla final.

## 5. Guardar el refresh token

Crear una última variable protegida en Vercel:

```text
SPOTIFY_REFRESH_TOKEN=<valor copiado en el paso anterior>
```

Hacer un nuevo redeploy. A partir de ese momento los invitados podrán buscar canciones y agregarlas sin iniciar sesión.

Los refresh tokens de Spotify vencen a los seis meses. Cuando eso ocurra, hay que repetir los pasos 4 y 5.

## Seguridad de la playlist

El sitio usa únicamente el identificador `4RN43fmkIW50QtNEKMRZOY`. No publica el enlace recibido con el parámetro `pt`, porque ese parámetro puede funcionar como invitación colaborativa. Es recomendable desactivar o volver a generar ese enlace desde Spotify si fue compartido fuera del grupo previsto.
