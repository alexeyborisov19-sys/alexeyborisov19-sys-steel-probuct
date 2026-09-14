import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { realProjects } from "@/data/real-projects";

const gallerySource = readFileSync(new URL("../components/ProjectPhotoGallery.tsx", import.meta.url), "utf8");
const nextConfigSource = readFileSync(new URL("../next.config.ts", import.meta.url), "utf8");
const jsonLdSource = readFileSync(new URL("../components/JsonLd.tsx", import.meta.url), "utf8");

const approvedProjectMediaHosts = [
  "static.tildacdn.com",
  "images.cdn-cian.ru",
  "www.rabochy-put.ru",
  "vostokstroy67.ru",
  "smolgazeta.ru",
  "static.mk.ru",
  "smoldaily.ru",
  "vestnikstroy.ru",
  "sdelanounas.ru",
];

test("project card images are first-party paths", () => {
  for (const project of realProjects) {
    assert.ok(
      project.image.startsWith("/"),
      `${project.slug} must use a first-party project card image, got ${project.image}`,
    );
  }
});

test("approved third-party project media hosts are whitelisted in Next image and CSP config", () => {
  for (const host of approvedProjectMediaHosts) {
    assert.equal(
      nextConfigSource.includes(host),
      true,
      `${host} must remain whitelisted so approved project photography can render`,
    );
  }
  assert.doesNotMatch(nextConfigSource, /remotePatterns:\s*\[\]/);
});

test("project gallery renders approved photo sources with visible attribution", () => {
  assert.match(gallerySource, /src=\{photo\.src\}/);
  assert.match(gallerySource, /href=\{photo\.sourceUrl\}/);
  assert.match(gallerySource, /Источник: \{photo\.credit\}/);
  assert.doesNotMatch(gallerySource, /право на публикацию файла не подтверждено/);
  assert.doesNotMatch(gallerySource, /Оригинал фото/);
});

test("JSON-LD removes third-party image URLs before serialization", () => {
  assert.match(jsonLdSource, /key === "image"/);
  assert.match(jsonLdSource, /isThirdPartyHttpUrl/);
  assert.match(jsonLdSource, /filter\(\(item\) => item !== undefined\)/);
});
