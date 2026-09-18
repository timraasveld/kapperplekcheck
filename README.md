# Kapperplekcheck

Lokale app die vrije Barbershop-momenten bij Hair Kappersopleiding volgt.

## Android

Download de nieuwste `kapperplekcheck-v*.apk` via
[GitHub Releases](https://github.com/timraasveld/kapperplekcheck/releases).
Open het bestand op een Android-telefoon en geef de browser of bestandsapp
eenmalig toestemming om onbekende apps te installeren. Android 7 of nieuwer is
vereist.

De APK bevat de volledige interface en haalt beschikbaarheid rechtstreeks op
vanaf de boekingssite. Er draait geen externe Kapperplekcheck-server en er
worden geen selecties naar een eigen server gestuurd. De app moet in deze
eerste versie open blijven om iedere tien minuten te controleren.

## Webversie starten

Vereist Node.js 20 of nieuwer.

```powershell
npm start
```

Open daarna <http://127.0.0.1:3000>.

Vink per werkdag Ochtend, Middag of Avond aan. De app bewaart de selectie in de browser, controleert meteen en daarna iedere 10 minuten. De eerste controle toont bestaande beschikbaarheid zonder melding. Een latere overgang van geen plek naar een vrije plek geeft geluid en, na toestemming, een browsermelding.

De tab moet open blijven om te controleren. De knop **Boeken** opent het exacte moment op de officiële boekingssite.

## Testen

```powershell
npm test
```

## Android ontwikkelen

Vereist Node.js 20 of nieuwer. Bouw en synchroniseer de webbestanden met het
Android-project:

```powershell
npm ci
npm run android:sync
```

Open het project daarna in Android Studio:

```powershell
npm run android:open
```

## Een release publiceren

Release-APK's worden permanent ondertekend. Voer de eenmalige configuratie uit
vanuit Git Bash en bewaar `kapperplekcheck-release.jks` ook in een versleutelde
back-up buiten deze repository:

```bash
bash scripts/setup-android-signing.sh
```

De wizard maakt de sleutel en configureert deze GitHub Actions-secrets:
`ANDROID_KEYSTORE_BASE64`, `ANDROID_KEYSTORE_PASSWORD`, `ANDROID_KEY_ALIAS` en
`ANDROID_KEY_PASSWORD`.

Publiceer daarna een versie door een tag te pushen:

```powershell
git tag v0.1.0
git push origin v0.1.0
```

De Android-workflow voert de tests uit, bouwt en verifieert de ondertekende APK,
maakt een SHA-256-controlebestand en voegt beide bestanden toe aan GitHub
Releases. Gewone pushes en pull requests leveren alleen een debug-APK als
workflow-artifact op.
