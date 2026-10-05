# Public wire DTOs and native styling

The rc.2 public TYPERT Zod emitter does not project `typeof sourceKinds[number]` indexed-access aliases. Public wire types therefore declare explicit literal unions; their runtime schemas still validate the same allowed kinds. DTOs are re-exported from the Contracts package root for generator-resolved public imports. No codec is weakened or replaced by `unknown`.

Native Desktop rendering exposed invalid assumed `--dsw-bg` / `--dsw-border` aliases. The Client now uses target `docs/web-styling.zh.md`, `ui-theme` semantic aliases, shared Input/Checkbox/Menu controls and CSS Modules. Theme values stay owned by DSH.
