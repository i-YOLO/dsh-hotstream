# Composition owns ordered resource release

The bundle entry assembles Host and SQLite library providers. It registers the Host package's published Typert manifest explicitly, as the target version's Typert loader documents for nested contributions. The Client companion remains its own bare Loader row.

SQL remains exclusively in storage-sqlite; the Host controller only consumes its public storage port. The bundle composition entry imports provider factories, not a SQL driver. The provider factory and auxiliary audit Context are owned by one awaited bundle disposer, which drains Host requests and audit handles before SQLite closes. They do not install separate automatic resource closers that could race under Cordis's parallel asynchronous disposal.

This retains the accepted package responsibilities and one installation entry. M0 exposes diagnostic tables and a simulated provider only under explicit test configuration; these are not migrated news algorithms.
