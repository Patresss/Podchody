# Wdrożenie na Synology przez GitHub Container Registry

Ta instrukcja nie zawiera prywatnego adresu NAS-a, portu SSH ani hasła. Aplikacja jest uruchamiana z gotowego obrazu Docker na porcie `3137`, a istniejący Cloudflare Tunnel pozostaje osobną usługą.

## Co jest potrzebne

Skopiuj na Synology do katalogu `/volume2/docker/podchody`:

- [`deploy/synology/docker-compose.yaml`](../deploy/synology/docker-compose.yaml),
- plik `.env` utworzony na podstawie [`deploy/synology/.env.example`](../deploy/synology/.env.example).

Gotowy obraz będzie publikowany pod adresem `ghcr.io/patresss/podchody:latest` po każdym poprawnym wysłaniu zmian do gałęzi `main`.

## 1. Pierwsza publikacja obrazu

Po wysłaniu workflow `.github/workflows/publish-container.yml` otwórz na GitHubie zakładkę **Actions**. Zadanie **Test and publish container image** uruchomi testy i zbuduje obraz dla `linux/amd64` oraz `linux/arm64`.

Pierwszy utworzony pakiet GHCR może być prywatny. Najprościej ustawić go jako publiczny:

1. Na GitHubie otwórz profil, następnie **Packages** i pakiet `podchody`.
2. Wejdź w **Package settings**.
3. Wybierz **Change visibility → Public**.

Obraz nie zawiera bazy, zdjęć ani haseł. Te dane pozostają wyłącznie w katalogu `/volume2/docker/podchody/data` na Synology.

## 2. Przygotowanie katalogu

Połącz się z Synology, korzystając z adresu, portu i użytkownika zapisanych wyłącznie w prywatnych notatkach. Następnie wykonaj:

```bash
sudo mkdir -p /volume2/docker/podchody/data
sudo chown -R 1026:101 /volume2/docker/podchody
sudo touch /volume2/docker/podchody/.env
sudo chmod 600 /volume2/docker/podchody/.env
```

Wgraj `docker-compose.yaml` do `/volume2/docker/podchody`.

## 3. Hasło i sekret sesji

Wygeneruj sekret:

```bash
openssl rand -hex 32
```

W pliku `/volume2/docker/podchody/.env` wpisz tylko:

```dotenv
ADMIN_PASSWORD="ustaw-tutaj-nowe-mocne-haslo"
SESSION_SECRET="wklej-tutaj-wynik-openssl"
```

`ADMIN_PASSWORD` musi mieć co najmniej 10 znaków, a `SESSION_SECRET` co najmniej 32 znaki. Nie trzeba generować `ADMIN_PASSWORD_HASH` — aplikacja sama bezpiecznie hashuje hasło przy uruchomieniu. Pliku `.env` nigdy nie wysyłaj do GitHuba.

## 4. Uruchomienie w Container Manager

1. Otwórz **Container Manager → Projekt → Utwórz**.
2. Wybierz katalog `/volume2/docker/podchody`.
3. Użyj znajdującego się tam pliku `docker-compose.yaml`.
4. Uruchom projekt.

Wersja terminalowa wykonuje to samo:

```bash
cd /volume2/docker/podchody
sudo docker compose pull
sudo docker compose up -d
sudo docker compose ps
sudo docker compose logs --tail=100 podchody
```

Jeśli Synology ma starsze polecenie, użyj `docker-compose` zamiast `docker compose`.

## 5. Cloudflare Tunnel

W istniejącym tunelu ustaw usługę Public Hostname na port `3137` Synology. Jeśli `cloudflared` działa bezpośrednio na NAS-ie lub w sieci hosta, celem może być:

```text
http://127.0.0.1:3137
```

W `docker-compose.yaml` pozostaw `COOKIE_SECURE=true`, ponieważ publiczny adres korzysta z HTTPS.

## 6. Aktualizacja

Po opublikowaniu nowego obrazu wykonaj:

```bash
cd /volume2/docker/podchody
sudo docker compose pull
sudo docker compose up -d
```

Możesz również uruchomić jednorazowy Watchtower tylko dla tego kontenera:

```bash
sudo docker run --rm \
  -v /var/run/docker.sock:/var/run/docker.sock \
  containrrr/watchtower \
  --run-once \
  --cleanup \
  podchody
```

## 7. Kopia zapasowa

Katalog `/volume2/docker/podchody/data` zawiera bazę SQLite, zdjęcia i miniatury. Obraz aplikacji można pobrać ponownie, ale tych danych nie da się odtworzyć bez kopii zapasowej. Dodaj cały katalog `data` do Hyper Backup.

## Prywatny obraz GHCR

Jeśli pakiet ma pozostać prywatny, zaloguj Docker na Synology do GHCR przy użyciu tokenu GitHub z uprawnieniem `read:packages`. Publiczny pakiet jest prostszy, ponieważ nie wymaga przechowywania tokenu na NAS-ie.
