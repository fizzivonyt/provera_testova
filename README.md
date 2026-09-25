# Testovi — školski planer

Srpska PWA aplikacija za praćenje školskih testova.

## Funkcije

- Dodavanje testa sa datumom i vremenom
- Podsetnici: 7 dana, 2 dana i 1 dan pre
- Prilagođeni podsetnik, npr. 2 dana pre u 14:30
- Kalendar
- Gemini AI uvoz više testova sa fotografije
- Gemini ključ unosi svaki korisnik u Podešavanja
- PWA / iPhone Home Screen
- Web Push backend preko Netlify Functions + Blobs

## Lokalno

```bash
npm install
npm run dev
```

## Gemini

Svaki korisnik može uneti svoj Gemini API ključ u Podešavanja. Aplikacija ga čuva u localStorage na tom uređaju i šalje ga direktno Google Gemini API-ju za AI uvoz slike.

Gemini free tier zavisi od modela i trenutnih Google limita.

## Push na iPhone-u

Za stvarne push notifikacije kada je aplikacija zatvorena, Netlify treba sledeće environment varijable:

- `VITE_VAPID_PUBLIC_KEY`
- `VAPID_PUBLIC_KEY`
- `VAPID_PRIVATE_KEY`
- `VAPID_EMAIL`

Generiši VAPID par preko `web-push` CLI-ja ili svog sigurnog deployment procesa.

`VITE_VAPID_PUBLIC_KEY` je javni ključ i može biti u frontend build-u. Privatni ključ nikad ne ide u frontend.

Korisnik na iPhone-u treba da otvori sajt u Safari-ju i izabere Share → Add to Home Screen → Open as Web App, zatim u aplikaciji uključi obaveštenja.

## Napomena o podsetnicima

Relativni podsetnici (`7 dana`, `2 dana`, `1 dan`) se šalju prema vremenu testa. Prilagođeni podsetnik koristi izabrano lokalno vreme na dan koji odgovara izabranom offsetu.

Za ozbiljnu produkciju sa mnogo korisnika preporučuje se da se podaci i subscription-i dodatno zaštite autentikacijom/rate limitingom.
