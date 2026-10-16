# GPT CORE Mobile - progetto APK

Struttura (la cartella `www` e il file `package.json` devono stare nella radice del repository):

```
package.json
capacitor.config.json
.gitignore
.github/workflows/build-apk.yml
www/            <- l'app (index.html, app.js, core.js, style.css, ...)
```

## APK con GitHub (senza installare nulla)
1. Crea un repository su GitHub e carica TUTTO il contenuto di questa cartella (compresa `.github`, che e' nascosta).
2. Vai su Actions -> "Build APK" -> Run workflow (parte anche da solo a ogni push).
3. A fine lavoro apri l'esecuzione e scarica l'artefatto **gpt-core-apk**: dentro c'e' `app-debug.apk`.

## APK sul PC
```
npm install
npx cap add android
npx cap sync android
cd android && ./gradlew assembleDebug
```
APK: android/app/build/outputs/apk/debug/app-debug.apk

## Aggiornare l'app
Sostituisci i file in `www/`, fai push (o `npx cap sync android` + ricompila).

## config.json (www/config.json)
L'app lo legge da sola a ogni avvio: non serve importarlo. Esempio per la Mail:
```
"mail": { "service": "service_xxx", "template": "template_xxx", "public_key": "xxxxxxxx" }
```
(accetta anche emailjs_service_id / emailjs_template_id / emailjs_public_key).
Se questi tre valori ci sono, la Mail e' pronta e l'app non chiede piu' nulla.
Le chiavi API si possono aggiungere dallo Store dell'app (consigliato) oppure in "api_keys".

ATTENZIONE: config.json finisce dentro l'APK e nel repository. Tieni il repository PRIVATO se ci metti chiavi.
La password Gmail NON va mai in questo file: la Public Key di EmailJS invece e' fatta per stare nell'app.
