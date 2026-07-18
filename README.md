# Podchody

Samodzielnie hostowana aplikacja webowa do przygotowywania obrazkowych podchodów dla dzieci. Zamienia zdjęcia charakterystycznych miejsc w punkty na mapie, układa trasę z długimi odcinkami i generuje gotowe materiały do wycięcia oraz plan dla organizatora.

Aplikacja jest projektowana przede wszystkim z myślą o dzieciach, które jeszcze nie czytają: kolejne miejsca są pokazywane zdjęciami i prostymi symbolami. Wszystkie fotografie, projekty i trasy pozostają na własnym serwerze.

## Najważniejsze możliwości

### Zdjęcia i mapa

- import JPG, PNG, WebP, HEIC i HEIF, również wielu zdjęć jednocześnie;
- automatyczny odczyt GPS i daty wykonania z metadanych EXIF;
- ręczne poprawianie współrzędnych przez przeciągnięcie zdjęcia na mapie, kliknięcie mapy lub wpisanie wartości;
- jedno zdjęcie zawsze odpowiada jednemu punktowi;
- wskazywanie dokładnego schowka bezpośrednio na fotografii;
- przyjazne nazwy i symbole punktów zamiast technicznych nazw plików;
- wybór zdjęcia głównego projektu;
- mapa OpenStreetMap z miniaturami zdjęć jako znacznikami.

### Układanie gry

- dowolna liczba projektów, dzięki czemu aplikację można wykorzystać na innym osiedlu, w parku albo podczas wyjazdu;
- wybór konkretnej liczby punktów, zaznaczanie wszystkich zdjęć i zaznaczanie zakresów z klawiszem Shift;
- algorytm preferujący długie odcinki, aby dzieci biegały pomiędzy odległymi punktami;
- ponowne losowanie oraz ręczna zmiana kolejności;
- osobna, krótka kolejność chowania kartek dla organizatora;
- podsumowanie długości trasy szukających i chowającego;
- opcjonalne losowe zagadki na kartach:
  - liczenie kropek,
  - dokończenie obrazkowego wzoru,
  - dodawanie i odejmowanie do 10,
  - dodawanie i odejmowanie do 20.

### Materiały do druku

- `karty-do-wyciecia.pdf` — cztery jednostronne karty na jednej stronie A4, przygotowane do prostego cięcia na krzyż;
- `plan-organizatora.pdf` — mapa gry dzieci, chronologia szukania, plan chowania oraz odległości obu tras;
- białe, oszczędne tło dostosowane do domowej drukarki;
- nazwa trasy i dyskretne oznaczenia kolejności na każdej wyciętej karcie;
- bezpośrednie pobieranie każdego PDF-u albo całego zestawu jako ZIP;
- dokumenty są składane programistycznie w przeglądarce — bez AI i bez wysyłania zdjęć do zewnętrznego generatora.

## Jak działa zabawa

Karta startowa pokazuje pierwsze miejsce. Każda kolejna karta łączy dwie fotografie: u góry organizator widzi, gdzie ją schować, a na dole dziecko widzi miejsce, do którego ma pobiec. Znaleziona tam kartka prowadzi dalej, aż do karty mety.

W planie organizatora znajduje się zarówno kolejność gry dzieci, jak i zoptymalizowana kolejność rozkładania kartek. Algorytm korzysta ze współrzędnych, dlatego dorosły powinien zawsze sprawdzić trasę pod kątem ulic, ogrodzeń i innych przeszkód.

## Szybki start przez Docker Compose

Wymagany jest Docker z wtyczką Compose.

```bash
cp .env.example .env
docker compose build
docker compose run --rm app node apps/server/dist/hash-password-cli.js
```

Ostatnie polecenie poprosi o hasło administratora i zwróci jego bezpieczny hash. Wklej go do `ADMIN_PASSWORD_HASH` w pliku `.env`. Następnie wygeneruj sekret sesji:

```bash
openssl rand -hex 32
```

Wklej wynik do `SESSION_SECRET`. Przy publicznym serwerze z HTTPS ustaw `COOKIE_SECURE=true`, a następnie uruchom aplikację:

```bash
docker compose up -d
```

Domyślny adres to `http://adres-serwera:3000`, a domyślna nazwa użytkownika to `admin`. Aplikacja nie potrzebuje klucza API do OpenStreetMap.

Katalog `data/` zawiera bazę SQLite, oryginalne zdjęcia i miniatury. Nie jest częścią repozytorium i powinien być objęty osobną kopią zapasową.

## Uruchomienie deweloperskie

Wymagany jest Node.js 22 lub nowszy.

```bash
npm ci
cp .env.example .env
npm run hash-password
npm run dev
```

Wygenerowany hash hasła i sekret sesji należy wpisać do `.env`. Frontend działa pod `http://localhost:5173`, a API na porcie `3000`. Vite automatycznie przekazuje żądania API do serwera.

## Bezpieczeństwo i prywatność

- dostęp do aplikacji jest chroniony loginem, hasłem i podpisaną sesją;
- w konfiguracji przechowywany jest hash hasła, nigdy zwykłe hasło;
- zdjęcia oraz baza danych nie opuszczają własnego serwera;
- pliki `.env`, `data/` i lokalny katalog `zdjecia/` są ignorowane przez Git;
- publiczne wdrożenie powinno działać wyłącznie przez HTTPS za Caddy albo Nginx.

## Kontrola jakości

```bash
npm run check
```

Polecenie uruchamia sprawdzanie typów, testy backendu i frontendu oraz produkcyjny build.

## Technologia

- React 19, TypeScript i Vite;
- MapLibre GL oraz kafelki OpenStreetMap;
- Express, SQLite, ExifTool i Sharp;
- Canvas, jsPDF i JSZip;
- pojedynczy obraz Docker oraz trwały katalog danych.

## Dokumentacja

- [Instrukcja wdrożenia](docs/DEPLOYMENT.md)
- [Instrukcja obsługi](docs/USER_GUIDE.md)
- [Bezpieczeństwo i kopie zapasowe](docs/SECURITY_AND_BACKUP.md)
- [Architektura](docs/ARCHITECTURE.md)

## Licencja

Repozytorium nie zawiera obecnie pliku licencji. Do czasu jego dodania wszystkie prawa pozostają przy autorze.
