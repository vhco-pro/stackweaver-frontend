---
title: "Public pages and search indexing"
description: "Configure your frontend's public URL, opt in to search indexing and verify crawler responses."
covers:
  - "frontend/nginx.conf"
  - "frontend/security-headers.conf"
  - "frontend/scripts/site-settings.mjs"
  - "frontend/src/config.ts"
  - "deploy/helm/stackweaver/**"
---

# Configure public pages and search indexing

Stackweaver's frontend serves public product pages and documentation alongside the signed-in
application. Installations request `noindex` by default. Opt in only when you intend to
publish those public pages at your own HTTPS address.

The indexing setting does not protect private data. Keep authentication and network access
controls in place. Crawlers must be able to fetch a page to read its `noindex` rule; the
robots file therefore allows crawling even when indexing is disabled. See
[Google's indexing controls](https://developers.google.com/search/docs/crawling-indexing/robots-meta-tag).

## Before you start

- A working [Compose](./docker-compose/README.md) or [Helm](./kubernetes/README.md) installation.
- An HTTPS hostname routed to the frontend and API, with a valid certificate.
- The same hostname configured for browser sign-in, callbacks and trusted origins. Follow
  [Configure a Zitadel domain](../../user-guides/authentication/zitadel-custom-domain.md)
  before changing an installation's address.
- Your existing image pins, chart version and deployment values. Keep them when applying
  these settings so a publishing change does not upgrade the installation.

The public URL controls canonical links and sitemap addresses. It does not create DNS
records, provision TLS or update identity-provider registrations.

## Helm

Add this section to your installation's values, using its actual HTTPS app hostname:

```yaml
frontend:
  publicSite:
    url: https://app.example.com
    indexing: true
```

Save the YAML above as `public-site-values.yaml`. Apply it to the existing release,
replacing the release, namespace and version with your installation's values:

```bash
CHART_VERSION="<your-installed-chart-version>"
helm upgrade stackweaver oci://ghcr.io/vhco-pro/charts/stackweaver \
  --namespace stackweaver --version "$CHART_VERSION" \
  --reuse-values --values public-site-values.yaml
```

The chart supplies the frontend's runtime and nginx settings; the image does not need rebuilding.
Set `indexing: false` to retain the URL while requesting exclusion from search and disabling
the sitemap response.

An optional clean path prefix, such as `https://app.example.com/stack`, also sets the
frontend's base path. Use it only with matching reverse-proxy and browser callback settings.
The indexing setting does not configure those routes or registrations for you. A dedicated
app hostname is the simpler starting point.

## Docker Compose

The [downloadable Compose bundle](./docker-compose/README.md#1-download-the-complete-bundle)
includes an optional public-site override. Run these commands in the extracted bundle's
directory, alongside its existing configuration:

```bash
cp public-site-settings.conf.example public-site-settings.conf
```

Edit `public-site-settings.conf`. Set your installation's HTTPS address consistently in the
site URL and sitemap line. This example publishes at the hostname root:

```nginx
set $sw_site_url "https://app.example.com";
set $sw_base_path "";
set $sw_noindex "";
set $sw_sitemap_line "Sitemap: https://app.example.com/sitemap.xml";
```

An empty `sw_noindex` opts public pages in to indexing. To request exclusion instead, use
`set $sw_noindex "noindex, nofollow";` and `set $sw_sitemap_line "";`.

Validate the combined configuration and recreate only the frontend so nginx loads the file:

```bash
docker compose -f docker-compose.yml -f docker-compose.public-site.yml config --quiet
docker compose -f docker-compose.yml -f docker-compose.public-site.yml \
  up -d --no-deps --force-recreate frontend
```

The override mounts `public-site-settings.conf` at `/etc/nginx/public-site-settings.conf`.
It preserves the bundle's generated `env.js` and existing identity configuration. Use the
same combined Compose files for subsequent frontend configuration changes. This supplied
example uses the hostname root; a custom prefix also needs matching runtime base-path and
proxy configuration.

## Verify the responses

Set the actual public URL, including a configured prefix if applicable:

```bash
SITE_URL="https://app.example.com"
curl -sSI "$SITE_URL/blog"
curl -fsS "$SITE_URL/robots.txt"
curl -sSI "$SITE_URL/sitemap.xml"
curl -sSI "$SITE_URL/a-missing-public-page"
```

| Check | Indexing enabled | Indexing disabled |
|---|---|---|
| Public HTML, such as `/blog` | HTTP 200 without a `noindex` response header. | HTTP 200 with `X-Robots-Tag: noindex, nofollow`. |
| `/robots.txt` | Text response allowing crawling, with your sitemap address. | Text response allowing crawlers to read the indexing policy. |
| `/sitemap.xml` | HTTP 200 with an XML content type and your configured public URLs. | HTTP 404. |
| Unknown public page | HTTP 404. | HTTP 404. |

When indexing is enabled, inspect the sitemap body and a page's initial HTML as well:

```bash
curl -fsS "$SITE_URL/sitemap.xml"
curl -fsS "$SITE_URL/blog"
```

Check that sitemap entries and the page's canonical link use your configured address.
Private application and sign-in routes should retain their `noindex` policy. Public content
must be readable in the initial HTML; an empty root element is not a successful check.
Only published article sources appear in public discovery and the sitemap.

If you use Search Console, verify ownership and submit the sitemap for this address after
these checks pass. [Sitemap submission is a hint](https://developers.google.com/search/docs/crawling-indexing/sitemaps/build-sitemap),
not a guarantee of indexing or search rankings.
