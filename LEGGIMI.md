# GPT CORE Mobile - Android + iOS

## DA FARE (in ordine)
1. Estrai questo zip. Dentro ci sono: .github (cartella nascosta!), assets, www, package.json, capacitor.config.json, .gitignore.
2. Crea un repository GitHub PRIVATO e carica TUTTO il contenuto, compresa la cartella .github.
3. Actions -> "Build Android (APK)" e/o "Build iOS (IPA non firmato)" -> Run workflow -> scarica il file dagli artefatti.
Non serve altro: non c'e' niente da installare ne' da compilare a mano.

```
package.json
capacitor.config.json
assets/                     <- icona + splash (servono solo alla build, non finiscono nell'app)
.github/workflows/
   build-apk.yml            <- Android
   build-ios.yml            <- iOS
www/                        <- l'app vera (contenuto dell'APK/IPA)
   index.html  config.json  manifest.webmanifest  sw.js
   assets/   (icone e stile)     scripts/   (core.js, app.js)
```
Tutto va nella RADICE del repository (compresa la cartella nascosta `.github`). Tieni il repository PRIVATO.

## Android
GitHub -> Actions -> "Build Android (APK)" -> Run workflow -> scarica l'artefatto **gpt-core-apk** (app-debug.apk) e installalo.

## iOS
GitHub -> Actions -> "Build iOS (IPA non firmato)" -> Run workflow -> scarica **gpt-core-ipa** (GPT-CORE.ipa).
L'IPA NON e' firmato: iOS non lo apre cosi' com'e'. Per installarlo:
- **Gratis**: AltStore o Sideloadly dal PC/Mac con il tuo Apple ID (firma per 7 giorni, poi si rifa').
- **Definitivo / TestFlight / App Store**: serve l'Apple Developer Program (99 $/anno) e la firma con certificato.
iOS si compila solo su macOS: per questo il workflow usa un server Mac di GitHub (i minuti macOS costano 10x su repository privati oltre la quota gratuita).

## Primo avvio
1. Schermata di accesso: **Continua con Google** oppure **email + password** (crea account / accedi).
2. Poi ti chiede il **nome**; da quel momento saluto, avatar e risposte si adattano a te.
3. Le volte dopo entra direttamente. Per cambiare utente: Impostazioni -> Esci dall'account.
Gli account email sono **locali**: restano solo sul telefono (password salvata con hash PBKDF2), non esiste un server.
Scrivere `/mail` in chat apre la Mail.

## Accesso Google - cosa serve perche' funzioni
Usa il flusso OAuth nel browser di sistema (PKCE) con `google.ios_client_id` di `www/config.json`; i token non vengono salvati.
- L'ID cliente iOS e' legato al **bundle ID** registrato su Google Cloud: deve coincidere con `appId` in `capacitor.config.json` (ora `it.flubatir.gptcore`). Se hai registrato un altro bundle ID, cambia `appId`.
- Con AltStore/Sideloadly il bundle ID puo' essere modificato in fase di firma: in quel caso Google rifiuta l'accesso. Usa l'email oppure installa con il bundle ID originale.
- Su Android viene usato lo stesso ID cliente (non c'e' un ID Android in config.json). Se Google rifiuta l'accesso, serve un client OAuth di tipo Android sul progetto Google Cloud.
- Nel browser/PWA l'accesso Google non e' disponibile (solo nell'app installata).

## config.json (www/config.json)
Letto da solo a ogni avvio (system prompt anche come lista, mail, help.email, google). Mail: "mail": { "service": "...", "template": "...", "public_key": "..." }
config.json finisce dentro l'app: non metterci la password Gmail. Chiavi API: meglio dallo Store dell'app.

## Aggiornare
Sostituisci i file in www/ e fai push: ripartono entrambe le build.
