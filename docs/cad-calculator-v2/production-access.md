# Production application access

`STEEL_PRODUCT_PRODUCTION_APP_ENABLED=true` opts only production routes into the existing account/session services. The saved `PD_ADMIN_ENABLED` flag is not changed; personal-data pages and APIs retain their original gate. Production pages and revision APIs authenticate with the scoped environment. Password, rate-limit, CSRF, session revocation and audit implementations are shared with the existing tested service.

Login: `/internal/production-access/login`. Password change: `/internal/production-access/change-password`. Existing personal-data administrators remain compatible when their own subsystem is enabled.

The owner explicitly requested the first administrator. The manual `Configure production calculator access` workflow accepts only an RSA public key, checks the deployed SHA, prepares protected directories, invokes the bootstrap and restarts the existing app. The bootstrap refuses an existing production-admin username, backs up an existing database locally before migration, generates missing independent keys, creates an account requiring password change and atomically saves the production-only flag. It does not enable the personal-data UI or paid AI.

Credentials leave the host only as RSA-OAEP/SHA-256 ciphertext in a one-day GitHub artifact. The private key stays on the operator's local machine. Decrypt locally into a 0600 file and provide it to the owner; never commit or log passwords. User must change the temporary password on first login. Do not rerun to reset an existing account.

Verification covers isolated bootstrap, no-overwrite behavior, encrypted delivery, 0600 permissions, first login, forced password change, CSRF failure, logout/revocation and PD remaining disabled. Production uses Secure, HttpOnly session cookies. The development-only eval allowance is scoped to production-access pages for Next dev; production CSP does not permit eval.
