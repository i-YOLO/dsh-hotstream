# Explicit HTTPS DNS for guarded collection

The authorized real RSS check found local DNS answers in the reserved fake-IP range. The ordinary direct-network guard correctly refused them. No host DNS, Clash rules, system proxy, TLS validation or private-address checks were changed.

Runtime settings now have an explicit system/public-doh DNS choice; system remains the default. The diagnostic uses the documented Cloudflare JSON endpoint at https://1.1.1.1/dns-query with TLS verification enabled. Responses are size/time bounded, validated as A/AAAA records and rejected if any address is blocked. Both the URL check and the actual socket lookup use the same resolver contract. Redirect checks and origin-bound credentials remain enforced. Resolver agents/caches are owned by the coordinated runtime shutdown.

Reference: https://developers.cloudflare.com/1.1.1.1/encryption/dns-over-https/make-api-requests/dns-json/

The real public-DNS run fetched all 18 locked default RSS sources and stored 144 initial candidates (eight per source) in artifacts/live-rss/authorized-public-dns. No model or paid-collector request was possible in that diagnostic. This is collection evidence, not editorial/publication acceptance. The first system-DNS run was interrupted by a diagnostic queue-order assertion, which was repaired by giving each concurrent source a distinct claim kind.
