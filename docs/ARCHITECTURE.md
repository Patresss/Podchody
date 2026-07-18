# Architektura

## Przepływ danych

1. Przeglądarka wysyła zdjęcia do chronionego API.
2. Serwer zapisuje oryginał, odczytuje EXIF przez ExifTool i przygotowuje JPEG do podglądu przez Sharp; HEIC ma osobną ścieżkę konwersji.
3. Punkt, współrzędne EXIF, współrzędne skorygowane i pozycja schowka trafiają do SQLite.
4. Generator najpierw wybiera zdjęcia równomiernym losowaniem bez wag, a następnie tworzy wiele permutacji wybranego zestawu i układa kolejność zgodnie ze stylem trasy.
5. Przeglądarka składa mapy, zdjęcia, ikony, zagadki oraz tekst w Canvas i zapisuje dwa PDF-y, dostępne osobno lub w ZIP. Nie jest używane AI ani zewnętrzny generator dokumentów.

## Moduły

```text
apps/web     React, MapLibre, edycja punktów, trasy, PDF
apps/server  Express, logowanie, SQLite, EXIF, miniatury, algorytm
data/        baza SQLite i pliki użytkownika (tworzone w czasie pracy)
docs/        dokumentacja użytkowa i wdrożeniowa
```

Produkcja działa jako jeden proces Node.js. Serwer udostępnia zbudowany frontend i API pod tym samym adresem, dzięki czemu nie jest potrzebna konfiguracja CORS.

## Model danych

- `projects` — niezależne miejsca/zabawy;
- `points` — jedno zdjęcie i jeden punkt; zawiera oryginalny GPS, aktualny GPS oraz opcjonalny celownik schowka;
- `routes` — nazwa, uporządkowana lista identyfikatorów punktów, policzone statystyki oraz opcjonalne rodzaje zagadek.

Usunięcie projektu usuwa również jego trasy, rekordy punktów i pliki zdjęć. Punkt używany przez zapisaną trasę jest chroniony przed przypadkowym usunięciem — najpierw trzeba usunąć tę trasę.

## Algorytm trasy

Algorytm ma dwa niezależne etapy. Najpierw tasuje wszystkie dostępne zdjęcia algorytmem Fishera–Yatesa i bierze żądaną liczbę punktów. Każdy punkt ma dzięki temu jednakową szansę, niezależnie od położenia.

Następnie planuje wyłącznie kolejność już wybranego zestawu. Odległość między współrzędnymi jest liczona wzorem haversine. Dla każdej próby kolejny punkt jest losowany z wagą odpowiednią dla wybranego stylu. Kandydaci dostają ocenę za:

- dużą sumę długości odcinków;
- dobry najkrótszy odcinek;
- karę za odcinki wyraźnie krótsze od mediany odległości w zbiorze.

Losowany jest jeden z najlepszych układów, a nie zawsze pojedyncze optimum. Tryb **Dużo biegania** wpływa więc tylko na kolejność przejść, nigdy na to, które zdjęcia zostaną wybrane. Trasa używa każdego wybranego punktu dokładnie raz i nie wraca automatycznie do startu.

## API

Wszystkie endpointy poza `/api/health` i `/api/auth/login` wymagają podpisanej sesji administratora.

- `POST /api/auth/login`, `POST /api/auth/logout`, `GET /api/auth/session`;
- CRUD `/api/projects`;
- `POST /api/projects/:id/photos`;
- `PATCH|DELETE /api/points/:id`;
- odczyt chronionych miniatur i oryginałów;
- CRUD `/api/routes`, ponowne losowanie oraz zmiana kolejności.

Walidacja wejścia odbywa się na serwerze. Pliki są odczytywane przez identyfikatory z bazy, nie przez ścieżki przekazane przez klienta.

## Testy

Testy obejmują hashowanie i weryfikację hasła, własności losowanej trasy, obliczenia odległości oraz główny przepływ API z uwierzytelnieniem. Produkcyjny build i sprawdzanie typów uruchamia `npm run check`.
