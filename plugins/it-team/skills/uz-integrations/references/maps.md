# Maps and location in Uzbekistan

Checked 2026-10-18. Legend: [verified] official doc · [unverified] not stated there.

## Choosing

| Need | Default |
|---|---|
| Telegram bot: get the user's location | `KeyboardButton` with `request_location: true` (private chats only) → `Message.location` with `latitude`/`longitude` [verified, https://core.telegram.org/bots/api]. No map API needed |
| Public, free web or Mini App: show points, pick an address | **Yandex Maps JS API v3** on the free tier, *if the terms below allow it* |
| Paid / closed SaaS, admin panel behind login with restricted access, courier or vehicle tracking | Yandex **commercial license** (budget it in the estimate), or 2GIS, or OSM via a paid tile provider |
| Only a static map or simple markers, no geocoding | Leaflet + a hosted OSM tile provider |

Yandex is the map most local users know, and its address data for Uzbekistan is good. But it has
**no Uzbek UI language** (see below). Record the choice and license cost in an ADR.

## Yandex Maps JS API v3 [verified]
- Connect: `https://api-maps.yandex.ru/v3/?apikey=<key>&lang=ru_RU`, then `await ymaps3.ready`.
  Get the key at https://developer.tech.yandex.com/; **v3 keys require the "HTTP Referer"
  restriction**, so add every environment's domain (including the dev tunnel for Mini Apps).
  https://yandex.com/dev/jsapi30/doc/en/common/connection/javascript
- `lang` values: `ru_RU, ru_UA, uk_UA, tr_TR, en_RU, en_US, he_IL, en_IL`. **No `uz_UZ`.** For
  an Uzbek UI, use `ru_RU` or `en_US` for map labels and translate our own controls.
  https://yandex.com/dev/jsapi30/doc/en/map/localization
- React: `ymaps3.import('@yandex/ymaps3-reactify')` → `reactify.bindTo(React, ReactDOM)` →
  `reactify.module(ymaps3)`; types from `@yandex/ymaps3-types` (dev dependency). Docs say React
  16+; React 19 is not mentioned [unverified], so check it in the first map story.
  https://yandex.com/dev/jsapi30/doc/en/common/connection/reactify
- HTTP Geocoder: `https://geocode-maps.yandex.ru/v1?apikey=…&geocode=…&lang=…&format=json`
  (no `uz` lang). https://yandex.com/dev/geocode/doc/en/request
- **Free-tier terms** (https://yandex.ru/legal/maps_api/en/):
  - 4.1.1: only in sites or apps that are **free and open to an unlimited number of people**.
    Paid products and restricted access are not allowed (plain registration is OK).
  - 5.1.3: no monitoring of vehicles or people and no real-time dispatch.
  - 5.1.5: no storing Yandex data beyond a 30-day cache. Store coordinates the user picked, not
    geocoder output in bulk.
  - Daily limits: Geocoder 1,000 requests/day, Static API 1,000/day, Geosuggest 1,000/day.
    Repeated overuse can lead to a permanent block. Logos and copyright must stay visible.
- Commercial: geocoding, routing and panoramas are billed; a JS API license without geocoder or
  router starts at 120,000 RUB/year (https://yandex.com/dev/commercial/doc/en/concepts/faq).
  Prices change, so quote from the page when estimating.
- Proxy geocoder calls through our API (cache, rate limit, key not exposed beyond the referer-
  restricted JS key).

## 2GIS
- MapGL JS (`@2gis/mapgl`); key from the Platform Manager, 1-month demo key.
  https://docs.2gis.com/en/mapgl/overview
- The consumer app covers Tashkent, but **API data coverage for Uzbekistan is not stated in the
  docs [unverified]**. Confirm with 2GIS before choosing it.

## OpenStreetMap + Leaflet
- The public `tile.openstreetmap.org` servers have **no SLA**, require attribution and a real
  User-Agent/Referer, and forbid bulk prefetch (https://operations.osmfoundation.org/policies/tiles/).
  For production, use a hosted OSM tile provider or self-host.

## Data rules
- Store coordinates as `latitude`/`longitude` `numeric(9,6)` or PostGIS `geography(Point)` when
  the product queries by distance; add a GiST index then.
- A user's precise location is personal data; include it in the PII inventory
  (see `personal-data.md`).
