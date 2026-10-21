# BREAKLINE POOL — Physics Lab 0.3

Technický 3D prototyp biliardu pre projekt CSP Gaming Zone (web a neskôr Android).

## Spustenie

Na počítači spusti lokálny HTTP server v koreňovom priečinku:

```sh
python3 -m http.server 8080
```

Potom otvor http://localhost:8080. Prehliadač potrebuje internet na načítanie Babylon.js z CDN. Nie je nutný npm ani build krok.

## Ovládanie

- **Uchop viditeľné telo tága a ťahaj** pre natočenie okolo bielej gule (myš aj dotyk). Kliknutie pred tágom už nemení smer.
- Tlačidlá ± posunú smer o 0,25°.
- Posuvník mení silu úderu, tlačidlo ÚDER alebo medzerník vystrelí.
- Prepnúť kameru: pohľad zhora / 3D perspektíva.
- NOVÝ ROZSTREL opäť rozostaví 15 gúľ.

## Rozsah 0.1

- 3D scéna s deväťstopovým stolom (hracia plocha 2,54 × 1,27 m), 16 guľami a dvoma kamerami.
- Oddelený lokálny 2D solver pohybu na ploche v SI jednotkách, pevný krok 1/240 s.
- Guľa–guľa, jednoduchý mantinel, zúžené prototypové pohlcovanie vreciek, spomaľovanie.
- Gule ostávajú v reálnom priemere 57,15 mm; pohľad kamery je bližší. Vrecká majú menší grafický rozmer (roh 115 mm, stred 128 mm); konečná geometria čeľustí chýba.
- Cielené použitie: vizuálny a interakčný *physics lab*, nie hotový simulátor.

## Známe obmedzenia

**Fyzika 0.3 zatiaľ NIE JE kalibrovaná ani úplne realistická.** Má experimentálny model šmyku/valenia a orientačné účinky spodného/horného a bočného falšu, ale chýba presná kalibrácia s reálnym stolom, throw, overený model gumy/čeľustí vreciek a správne WPA pravidlá. Aktuálna detekcia vreciek je zjednodušená. 3D objekty zobrazujú 2D simuláciu v rovine stola.

Hra neobsahuje online zápasy, prihlásenie CSP, turnaje, ligy ani platené prvky. Nemá kód ani grafiku konkurenčných hier.

## Ďalšie kroky

1. Testy stop-shot / dohrávka / sťahovák / bočný falš s kalibráciou.
2. Presná geometria čeľustí a rozstrelu.
3. Rozhodcovský engine podľa WPA (8/9/10/14.1).
4. Colyseus multiplayer a integrácia do CSP.

## Testy

```sh
node --test tests/*.test.mjs
```

## Distribúcia Pages

Ak má projekt zapnuté GitHub Pages z vetvy `gh-pages`, nasadzovaciu vetvu treba po zmene `main` synchronizovať. Release 0.3 obsahuje cache-busting query parametre pre CSS a JS. Táto dokumentácia netvrdí, že server publikuje najnovší commit; kontrola nasadenia je samostatný krok.
