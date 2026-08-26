import assert from "node:assert/strict";
import test from "node:test";
import { organizationSchema, videoSchema } from "@/lib/schema";

const videos = [
  videoSchema({
    name: "Сталь Продукт — о компании",
    description: "Фильм о команде, инженерной экспертизе и реальном производстве компании «Сталь Продукт».",
    path: "/company#company-video",
    contentPath: "/video/company-film-flat.mp4",
    thumbnailPath: "/images/company-video-poster.png",
    uploadDate: "2026-07-21T08:17:40Z",
    duration: "PT1M59S",
  }),
  videoSchema({
    name: "Производство Сталь Продукт",
    description: "Короткая нарезка технологических операций: гибка, лазерная резка и сборка изделий из листового металла.",
    path: "/production#production-video",
    contentPath: "/video/production-showreel-web.mp4",
    thumbnailPath: "/images/production-showreel-poster.png",
    uploadDate: "2026-07-21T08:17:40Z",
    duration: "PT11S",
  }),
];

test("organization schema does not advertise videos on unrelated pages", () => {
  const schema = organizationSchema();
  assert.equal("subjectOf" in schema, false);
});

test("page-scoped video schemas expose valid absolute video metadata", () => {
  for (const video of videos) {
    assert.equal(video["@type"], "VideoObject");
    assert.equal(typeof video.uploadDate, "string");
    assert.equal(Number.isNaN(Date.parse(String(video.uploadDate))), false);
    assert.match(String(video.url), /^https:\/\/www\.steelprodukt\.ru\/(?:company|production)#/);
    assert.match(String(video.contentUrl), /^https:\/\/www\.steelprodukt\.ru\/video\//);
    assert.match(String(video.thumbnailUrl), /^https:\/\/www\.steelprodukt\.ru\/images\//);
  }
});
