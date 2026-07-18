# Wdrożenie na własnym serwerze

Gotowa instrukcja publikowania obrazu w GitHub Container Registry i uruchomienia go w Dockerze na Synology znajduje się w [instrukcji dla Synology](SYNOLOGY.md). Nie zawiera ona prywatnego adresu NAS-a ani portu SSH.

## Wariant zalecany: Docker Compose

W katalogu aplikacji wykonaj:

```bash
cp .env.example .env
docker compose build
docker compose run --rm app node apps/server/dist/hash-password-cli.js
```

Wpisz docelowe hasło administratora. Skopiuj wyświetlony hash do pliku `.env`:

```dotenv
ADMIN_USERNAME=admin
ADMIN_PASSWORD_HASH=tu_wklej_hash
SESSION_SECRET=tu_wklej_sekret
COOKIE_SECURE=true
TRUST_PROXY_HOPS=1
```

Sekret sesji można wygenerować poleceniem `openssl rand -hex 32`. Nie należy wpisywać zwykłego hasła do konfiguracji.

Uruchomienie i aktualizacja:

```bash
docker compose up -d
docker compose logs -f app
```

Po zmianie kodu lub pobraniu nowej wersji:

```bash
docker compose build
docker compose up -d
```

Kontener nasłuchuje wewnętrznie na porcie 3000. Dane są przechowywane w katalogu `./data` gospodarza.

## HTTPS i reverse proxy

Na publicznym serwerze aplikacja powinna być wystawiona wyłącznie przez HTTPS. Przykład dla Caddy:

```caddyfile
podchody.example.pl {
    reverse_proxy 127.0.0.1:3000
}
```

Przykład dla Nginx:

```nginx
server {
    listen 443 ssl http2;
    server_name podchody.example.pl;

    client_max_body_size 300M;

    location / {
        proxy_pass http://127.0.0.1:3000;
        proxy_set_header Host $host;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
    }
}
```

Przy HTTPS pozostaw `COOKIE_SECURE=true`. Przy wyłącznie lokalnym teście po HTTP ustaw `false`, inaczej przeglądarka nie zapisze ciasteczka logowania. `TRUST_PROXY_HOPS=1` odpowiada jednemu Caddy lub Nginx przed aplikacją; bez reverse proxy ustaw `0`.

## Limity i zasoby

- pojedynczy plik: maksymalnie 30 MB;
- jedno żądanie: maksymalnie 100 zdjęć;
- największe zużycie procesora występuje podczas konwersji HEIC i generowania miniatur;
- PDF-y powstają w przeglądarce, więc przy bardzo dużych trasach telefon może potrzebować więcej pamięci. Typowa trasa 10–20 punktów jest docelowym scenariuszem.

## OpenStreetMap

Aplikacja korzysta ze standardowych kafelków `tile.openstreetmap.org` i nie wymaga klucza API. Atrybucja OpenStreetMap jest wyświetlana na mapie. Ten wariant jest przeznaczony do zwykłego interaktywnego użycia, bez masowego pobierania i bez trybu offline.

Przy dużym ruchu należy podłączyć własnego dostawcę kafelków zgodnego z MapLibre i jego warunkami użycia.

## Sprawdzenie działania

```bash
docker compose ps
curl http://127.0.0.1:3000/api/health
```

Zdrowa aplikacja odpowiada kodem 200 i JSON-em z polem `ok: true`.
