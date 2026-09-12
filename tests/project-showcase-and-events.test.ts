import assert from "node:assert/strict";
import test from "node:test";
import { realProjectsShowcase } from "../data/real-project-showcase";
import { upcomingIndustryEvents } from "../data/upcoming-industry-events";

test("verified project showcase includes correctly identified Obninsk medical project and strengthened galleries", () => {
  const obninsk = realProjectsShowcase.find((project) => project.slug === "kb-8-fmba-obninsk");
  const solovinaya = realProjectsShowcase.find((project) => project.slug === "solovinaya-roshcha");
  const klovskiy = realProjectsShowcase.find((project) => project.slug === "klovskiy");
  const regionalHospital = realProjectsShowcase.find((project) => project.slug === "smolenskaya-oblastnaya-klinicheskaya-bolnitsa");
  const odkb = realProjectsShowcase.find((project) => project.slug === "odkb-novyy-korpus");
  const oncology = realProjectsShowcase.find((project) => project.slug === "onkologicheskiy-dispanser");
  const feniks = realProjectsShowcase.find((project) => project.slug === "feniks-pechersk");

  assert.ok(obninsk);
  assert.equal(obninsk.title, "Клиническая больница № 8 ФМБА России");
  assert.equal(obninsk.city, "Обнинск, Калужская область");
  assert.ok(obninsk.photos.length >= 2);
  assert.ok(solovinaya && solovinaya.photos.length >= 3);
  assert.ok(klovskiy && klovskiy.photos.length >= 2);
  assert.ok(regionalHospital && regionalHospital.photos.length >= 2);
  assert.ok(odkb && odkb.photos.length >= 2);
  assert.ok(oncology && oncology.photos.length >= 2);
  assert.ok(feniks && feniks.photos.length >= 4);
  assert.equal(realProjectsShowcase.some((project) => project.slug === "mrrc-tsyba-obninsk"), false);
});

test("upcoming industry events stay chronological, dated and linked to official sites", () => {
  assert.deepEqual(
    upcomingIndustryEvents.map((event) => event.shortName),
    [
      "Фасадная неделя",
      "Tube China",
      "100+ TechnoBuild",
      "Weldex",
      "ExpoCoating Moscow",
      "FENESTRATION BAU China",
      "Металл-Экспо",
      "Big 5 Global",
      "DMP Greater Bay Area Industrial Expo",
    ],
  );

  assert.equal(upcomingIndustryEvents.length, 9);

  for (const event of upcomingIndustryEvents) {
    assert.match(event.startDate, /^2026-/);
    assert.match(event.endDate, /^2026-/);
    assert.ok(event.endDate >= event.startDate);
    assert.match(event.url, /^https:\/\//);
  }

  for (let index = 1; index < upcomingIndustryEvents.length; index += 1) {
    assert.ok(upcomingIndustryEvents[index].startDate >= upcomingIndustryEvents[index - 1].startDate);
  }
});
