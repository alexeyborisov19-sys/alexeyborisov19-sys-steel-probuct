import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { realProjects } from "@/data/real-projects";

const gallerySource = readFileSync(new URL("../components/ProjectPhotoGallery.tsx", import.meta.url), "utf8");
const nextConfigSource = readFileSync(new URL("../next.config.ts", import.meta.url), "utf8");
const jsonLdSource = readFileSync(new URL("../components/JsonLd.tsx", import.meta.url), "utf8");

const projectMediaHosts = [
  "static.tildacdn.com",
  "smolgazeta.ru",
  "static.mk.ru",
  "images.cdn-cian.ru",
  "lic-mnogoprofilnyj-smolensk-r66.gosweb.gosuslugi.ru",
  "www.rabochy-put.ru",
  "vostokstroy67.ru",
  "smoldaily.ru",
  "vestnikstroy.ru",
  "sdelanounas.ru",
  "www.atlant-complex.ru",
];

test("project card images are first-party paths", () => {
  for (const project of realProjects) {
    assert.ok(
      project.image.startsWith("/"),
      `${project.slug} must use a first-party project card image, got ${project.image}`,
    );
  }
});

test("third-party project media hosts are not whitelisted in Next image or CSP config", () => {
  for (const host of projectMediaHosts) {
    assert.equal(
      nextConfigSource.includes(host),
      false,
      `${host} must not be whitelisted for automatic image loading`,
    );
  }
  assert.match(nextConfigSource, /remotePatterns:\s*\[\]/);
});

test("project gallery never renders a remote photo src as an image", () => {
  assert.match(gallerySource, /isRemoteSource\(photo\.src\)/);
  assert.match(gallerySource, /const remote = isRemoteSource\(photo\.src\)/);
  assert.match(gallerySource, /remote \? \(/);
  assert.match(gallerySource, /Оригинал фото/);
});

test("JSON-LD removes third-party image URLs before serialization", () => {
  assert.match(jsonLdSource, /key === "image"/);
  assert.match(jsonLdSource, /isThirdPartyHttpUrl/);
  assert.match(jsonLdSource, /filter\(\(item\) => item !== undefined\)/);
});
