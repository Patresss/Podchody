# Bezpieczeństwo i kopie zapasowe

## Logowanie

Aplikacja ma jedno konto administratora, bez publicznej rejestracji. Hasło nie jest przechowywane wprost — konfiguracja zawiera hash scrypt. Sesja jest podpisana sekretem, ma flagi `HttpOnly` i `SameSite=Lax`, a przy `COOKIE_SECURE=true` również `Secure`.

Logowanie ma ograniczenie liczby prób. Serwer ustawia nagłówki bezpieczeństwa i blokuje osadzanie aplikacji w obcych stronach.

## Zasady wdrożenia

- używaj HTTPS i mocnego, unikalnego hasła;
- `SESSION_SECRET` powinien mieć co najmniej 32 losowe znaki;
- nie publikuj pliku `.env`, katalogu `data/` ani portu bazy;
- ogranicz port 3000 zaporą do localhost, jeżeli korzystasz z reverse proxy;
- regularnie instaluj aktualizacje obrazu bazowego i zależności;
- nie używaj publicznego serwera kafelków OSM do pobierania offline ani dużego ruchu automatycznego.

## Co zawiera kopia

Cały trwały stan znajduje się w katalogu `data/`:

- `podchody.db` — baza projektów, punktów i tras;
- `uploads/` — oryginalne zdjęcia;
- `previews/` — podglądy używane przez interfejs i PDF-y.

Najprostsza poprawna kopia to archiwum całego katalogu wykonane po krótkim zatrzymaniu kontenera:

```bash
docker compose stop app
tar -czf podchody-backup-$(date +%F).tar.gz data
docker compose start app
```

Plik `.env` przechowuj osobno w bezpiecznym miejscu. Bez niego dane nadal istnieją, ale potrzebne będzie ustawienie nowego hasła i sekretu.

## Odtwarzanie

1. Zatrzymaj aplikację.
2. Zachowaj dotychczasowy katalog `data/` jako kopię awaryjną.
3. Rozpakuj kopię tak, aby powstał katalog `data/` z bazą i folderami zdjęć.
4. Upewnij się, że użytkownik kontenera ma prawo zapisu.
5. Uruchom aplikację i sprawdź kilka projektów, zdjęć oraz tras.

Kopia jest kompletna dopiero wtedy, gdy jej odtworzenie zostało przetestowane.

## Prywatność

Zdjęcia i rekordy GPS pozostają na serwerze aplikacji. Przeglądarka pobiera z OpenStreetMap wyłącznie kafelki potrzebne do pokazania aktualnego fragmentu mapy; dostawca kafelków może zobaczyć adres IP klienta oraz zakres mapy. Aplikacja nie pobiera lokalizacji telefonu i nie wysyła zdjęć do usług AI.

