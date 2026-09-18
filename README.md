# Kapperplekcheck

Lokale webapp die vrije Barbershop-momenten bij Hair Kappersopleiding volgt.

## Starten

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

De app gebruikt geen externe npm-pakketten.
