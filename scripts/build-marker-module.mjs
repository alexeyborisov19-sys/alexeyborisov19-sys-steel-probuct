/**
 * Stands in for Next.js build markers such as "server-only" and "client-only".
 *
 * Those imports are not packages: Next replaces them at build time, and their
 * whole job is to fail a build that puts server code in a client bundle. They
 * are absent from package.json and from the lockfile, so a plain node process
 * has nothing to resolve — which is what stopped the price refresh from
 * starting under the timer.
 *
 * At runtime the marker has no behaviour, so an empty module is the honest
 * equivalent of what Next substitutes.
 */
export {};
