import assert from "node:assert/strict";
import test from "node:test";
import { realProjectsShowcase } from "../data/real-project-showcase";
import { upcomingIndustryEvents } from "../data/upcoming-industry-events";

test("verified project showcase includes Obninsk medical project and galleries", () => {
  const obninsk = realProjectsShowcase.find((project) => project.slug === "mrrc-tsyba-obninsk");
  const solovinaya = realProjectsShowcase.find((project) => project.slug === "solovinaya-roshcha");
  const klovskiy = realProjectsShowcase.find((project) => project.slug === "klovskiy");
  const odkb = realProjectsShowcase.find((project) => project.slug === "odkb-novyy-korpus");

  assert.ok(obninsk);
  assert.equal(obninsk.city, "Обнинск, Калужская область");
  assert.ok(obninsk.photos.length >= 2);
  assert.ok(solovinaya && solovinaya.photos.length >= 3);
  assert.ok(klovskiy && klovskiy.photos.length >= 2);
  assert.ok(odkb && odkb.photos.length >= 2);
});

test("new industry events stay dated and linked to official sites", () => {
  assert.deepEqual(
    upcomingIndustryEvents.map((event) => event.shortName),
    ["100+ TechnoBuild", "Weldex", "ExpoCoating Moscow", "Металл-Экспо"],
  );

  for (const event of upcomingIndustryEvents) {
    assert.match(event.startDate, /^2026-/);
    assert.match(event.url, /^https:\/\//);
  }
});
