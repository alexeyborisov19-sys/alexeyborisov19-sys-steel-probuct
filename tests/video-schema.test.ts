import assert from "node:assert/strict";
import test from "node:test";
import { organizationSchema } from "@/lib/schema";

test("all organization videos include a valid upload date", () => {
  const schema = organizationSchema();
  const videos = schema.subjectOf as Array<Record<string, unknown>>;

  assert.equal(videos.length, 2);

  for (const video of videos) {
    assert.equal(video["@type"], "VideoObject");
    assert.equal(typeof video.uploadDate, "string");
    assert.equal(Number.isNaN(Date.parse(String(video.uploadDate))), false);
  }
});
