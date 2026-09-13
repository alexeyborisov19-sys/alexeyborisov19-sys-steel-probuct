import assert from "node:assert/strict";
import test from "node:test";
import { realProjects } from "@/data/real-projects";

test("project card images are local assets, not external hotlinks", () => {
  for (const project of realProjects) {
    assert.ok(
      project.image.startsWith("/"),
      `${project.slug} must use a local rights-reviewed project card image`,
    );
    assert.ok(
      !/^https?:\/\//i.test(project.image),
      `${project.slug} must not hotlink an external primary image`,
    );
  }
});

test("real-photo references remain attributable to source pages", () => {
  for (const project of realProjects) {
    if (!project.imageSourceUrl) continue;
    assert.match(project.imageSourceUrl, /^https?:\/\//i, `${project.slug} photo source must be an absolute source URL`);
  }
});
