# 10 pomysłów na dalsze ulepszenie aplikacji Podchody

Założenia: aplikacja pozostaje ogólna, działa dla zdjęć z dowolnego miejsca, jest prosta w obsłudze, nadaje się dla dzieci około 5 lat i może być uruchomiona na własnym serwerze.

## 1. Kontrola jakości punktów przed utworzeniem trasy

**Problem:** zdjęcie może mieć GPS, ale być nieczytelne, przedstawiać prawie to samo miejsce co inne zdjęcie albo nie mieć zaznaczonego dokładnego schowka.

**Pomysł:** przed generowaniem pokazywać krótką listę ostrzeżeń:

- brak dokładnego miejsca schowania na zdjęciu,
- dwa punkty leżą bardzo blisko siebie,
- zdjęcie jest ciemne lub mało wyraźne,
- współrzędne są wyraźnie oddalone od pozostałych punktów projektu.

**Najmniejsza wersja:** sprawdzanie braku znacznika schowka, odległości mniejszej niż np. 8 metrów oraz punktów odstających od całego obszaru.

**Priorytet:** wysoki.

## 2. Porównanie trzech propozycji trasy

**Problem:** przycisk „Losuj ponownie” działa dopiero po utworzeniu trasy, więc trudno porównać warianty przed podjęciem decyzji.

**Pomysł:** po wpisaniu liczby punktów pokazywać trzy gotowe warianty, np.:

- najwięcej biegania,
- najbardziej równomierne odcinki,
- najmniej powtarzających się części osiedla.

Każdy wariant miałby miniaturową mapę, długość całkowitą i najkrótszy odcinek.

**Najmniejsza wersja:** trzy małe mapy i przycisk „Wybierz tę trasę”.

**Priorytet:** średni.

## 3. Strefy mapy i zasada „zmieniaj część terenu”

**Problem:** sama odległość nie zawsze wystarcza. Kilka punktów może znajdować się przy tej samej alejce, mimo że matematycznie tworzą długą trasę.

**Pomysł:** automatycznie dzielić teren na strefy albo pozwolić organizatorowi narysować proste obszary, np. „plac zabaw”, „park”, „bloki”, „boisko”. Generator premiowałby przechodzenie między różnymi strefami.

**Najmniejsza wersja:** automatyczny podział punktów na 3-5 skupisk na podstawie współrzędnych, bez ręcznego edytora.

**Priorytet:** średni.

## 4. Przyjazne nazwy i symbole punktów dla organizatora

**Problem:** „Punkt 4” jest dobry na wydruku, ale przy większej bibliotece zdjęć organizator może chcieć szybko rozpoznać miejsce bez otwierania fotografii.

**Pomysł:** umożliwić opcjonalne nadanie punktowi krótkiej nazwy i symbolu, np. „ławka”, „zjeżdżalnia”, „duże drzewo”. Nazwa byłaby widoczna tylko w panelu organizatora; materiały dla dzieci nadal opierałyby się na zdjęciach.

**Najmniejsza wersja:** jedno opcjonalne pole „Nazwa miejsca” oraz wybór jednej z kilkunastu ikon.

**Priorytet:** średni.

## 5. Tryb przygotowania gry krok po kroku

**Problem:** nawet z PDF-em łatwo zapomnieć o jednej karcie albo schować ją w złym miejscu.

**Pomysł:** mobilna lista przygotowania gry. Organizator otwiera trasę w telefonie i przy każdym punkcie zaznacza:

- karta wydrukowana,
- karta schowana,
- miejsce sprawdzone,
- punkt gotowy.

Postęp byłby zapisywany osobno dla każdego przygotowania, bez zmieniania samej trasy.

**Najmniejsza wersja:** lista punktów z dużym przyciskiem „Gotowe” i paskiem postępu.

**Priorytet:** wysoki.

## 6. Tryb samodzielnego chowania przez dzieci

**Problem:** główną ideą jest umożliwienie dzieciom przygotowania gry bez czytania, ale grupa może pomylić karty lub ominąć etap.

**Pomysł:** aplikacja dzieli karty pomiędzy dzieci i pokazuje każdemu wyłącznie obrazkową parę:

1. tę kartę weź,
2. przy tym zdjęciu ją schowaj.

Bez tekstu, nazw plików i mapy. Po wykonaniu dziecko naciska duży przycisk z haczykiem, a dorosły widzi postęp całej grupy.

**Najmniejsza wersja:** jeden telefon przekazywany kolejno dzieciom, pełnoekranowe zdjęcie karty i miejsca schowania.

**Priorytet:** wysoki.

## 7. PWA i działanie bez internetu

**Problem:** na zewnątrz może być słaby zasięg, a mapa OpenStreetMap i zdjęcia mogą nie wczytać się w odpowiednim momencie.

**Pomysł:** instalowalna aplikacja PWA, która przed wyjściem zapisuje wybrany projekt, zdjęcia, trasę i potrzebny fragment mapy w telefonie.

**Najmniejsza wersja:** instalacja na ekranie głównym oraz dostęp offline do zdjęć, trasy i listy chowania. Buforowanie mapy można dodać później z uwzględnieniem zasad dostawcy kafelków.

**Priorytet:** wysoki przed używaniem aplikacji poza domem.

## 8. Eksport i import całego projektu

**Problem:** awaria serwera albo przenosiny na inne urządzenie mogą oznaczać utratę zdjęć, współrzędnych, schowków i tras.

**Pomysł:** eksport projektu do jednego pliku ZIP zawierającego zdjęcia oraz dane w formacie JSON. Taki plik można później zaimportować na innym serwerze.

**Najmniejsza wersja:** ręczne przyciski „Eksportuj projekt” i „Importuj projekt”, z kontrolą duplikatów.

**Priorytet:** wysoki.

## 9. Profile wydruku i oszczędzanie tuszu

**Problem:** różne drukarki mają inne marginesy, a pełne kolorowe zdjęcia zużywają dużo tuszu. Czasem potrzebny jest większy obraz, a czasem mniejsze karty.

**Pomysł:** przed pobraniem wydruków wybrać profil:

- standardowy: 4 karty na A4,
- duże zdjęcia: 2 karty na A4,
- oszczędny: jaśniejsze tła i ograniczone elementy dekoracyjne,
- czarno-biały: większy kontrast i wyraźne ramki.

**Najmniejsza wersja:** wybór 4 albo 2 kart na stronie oraz przełącznik „Oszczędzaj tusz”.

**Priorytet:** średni.

## 10. Bezpieczeństwo trasy

**Problem:** algorytm maksymalizujący bieganie nie wie, że pomiędzy punktami znajduje się ulica, parking, brama albo inne niebezpieczne miejsce.

**Pomysł:** pozwolić oznaczać na mapie obszary zabronione i punkty wymagające obecności dorosłego. Trasa nie powinna prowadzić prostą linią przez taki obszar, a plan organizatora powinien pokazywać ostrzeżenie.

**Najmniejsza wersja:** przy każdym punkcie przełącznik „Wymaga dorosłego” oraz opcjonalna notatka bezpieczeństwa widoczna tylko na planie organizatora.

**Priorytet:** bardzo wysoki przed szerszym użyciem aplikacji.

## Proponowana kolejność realizacji

1. Kontrola jakości punktów.
2. Tryb przygotowania gry krok po kroku.
3. Eksport i import projektu.
4. Bezpieczeństwo trasy.
5. Tryb samodzielnego chowania przez dzieci.
6. PWA i podstawowe działanie offline.
7. Profile wydruku.
8. Przyjazne nazwy i symbole punktów.
9. Porównanie trzech propozycji trasy.
10. Strefy mapy.

Największą wartość przy relatywnie małym nakładzie dają punkty 1, 5 i 8 z powyższej listy: zmniejszają ryzyko pomyłek, ułatwiają realne przygotowanie zabawy i zabezpieczają wykonaną pracę.
