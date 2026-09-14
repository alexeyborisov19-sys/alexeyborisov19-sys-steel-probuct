import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import test from "node:test";
import { realProjects } from "@/data/real-projects";
import { realProjectsShowcase } from "@/data/real-project-showcase";

const gallerySource = readFileSync(new URL("../components/ProjectPhotoGallery.tsx", import.meta.url), "utf8");
const nextConfigSource = readFileSync(new URL("../next.config.ts", import.meta.url), "utf8");
const jsonLdSource = readFileSync(new URL("../components/JsonLd.tsx", import.meta.url), "utf8");

// Hosts the project galleries used to hotlink. The photographs now live in
// public/images/projects, so none of these may come back into the image or CSP
// configuration: a file on someone else's server can disappear without notice.
const retiredProjectMediaHosts = [
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

test("every gallery photo is served by this site", () => {
  for (const project of realProjectsShowcase) {
    for (const photo of project.photos) {
      assert.ok(
        photo.src.startsWith("/"),
        `${project.slug} must publish gallery photos from this site, got ${photo.src}`,
      );
    }
  }
});

test("every gallery photo file exists in public/", () => {
  for (const project of realProjectsShowcase) {
    for (const photo of project.photos) {
      const file = new URL(`../public${photo.src}`, import.meta.url);
      assert.ok(existsSync(file), `${project.slug} refers to a missing file: public${photo.src}`);
    }
  }
});

test("every gallery photo keeps a visible credit and a source link", () => {
  for (const project of realProjectsShowcase) {
    for (const photo of project.photos) {
      assert.ok(photo.credit.trim().length > 0, `${project.slug}: photo ${photo.src} has no credit`);
      assert.ok(photo.sourceUrl.trim().length > 0, `${project.slug}: photo ${photo.src} has no source link`);
    }
  }
});

test("retired third-party media hosts stay out of Next image and CSP config", () => {
  for (const host of retiredProjectMediaHosts) {
    assert.equal(
      nextConfigSource.includes(host),
      false,
      `${host} must not be whitelisted for automatic image loading`,
    );
  }
  assert.match(nextConfigSource, /remotePatterns:\s*\[\]/);
});

test("project gallery renders photo sources with visible attribution", () => {
  assert.match(gallerySource, /src=\{photo\.src\}/);
  assert.match(gallerySource, /href=\{photo\.sourceUrl\}/);
  assert.match(gallerySource, /Источник: \{photo\.credit\}/);
});

test("JSON-LD removes third-party image URLs before serialization", () => {
  assert.match(jsonLdSource, /key === "image"/);
  assert.match(jsonLdSource, /isThirdPartyHttpUrl/);
  assert.match(jsonLdSource, /filter\(\(item\) => item !== undefined\)/);
});
