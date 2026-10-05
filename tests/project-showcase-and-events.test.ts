import assert from "node:assert/strict";
import test from "node:test";
import { realProjectsShowcase } from "../data/real-project-showcase";
import { upcomingIndustryEvents } from "../data/upcoming-industry-events";

test("verified project showcase includes correctly identified Obninsk medical project and strengthened galleries", () => {
  const obninsk = realProjectsShowcase.find((project) => project.slug === "mrrc-tsyba-obninsk");
  const solovinaya = realProjectsShowcase.find((project) => project.slug === "solovinaya-roshcha");
  const klovskiy = realProjectsShowcase.find((project) => project.slug === "klovskiy");
  const unity = realProjectsShowcase.find((project) => project.slug === "unity-development");
  const odkb = realProjectsShowcase.find((project) => project.slug === "odkb-novyy-korpus");
  const oncology = realProjectsShowcase.find((project) => project.slug === "onkologicheskiy-dispanser");
  const feniks = realProjectsShowcase.find((project) => project.slug === "feniks-pechersk");
  const vostok5 = realProjectsShowcase.find((project) => project.slug === "vostokstroy-vostochnaya-5");
  const kutuzova = realProjectsShowcase.find((project) => project.slug === "kutuzova-12-1");
  const smolstrom = realProjectsShowcase.find((project) => project.slug === "smolstrom-marii-oktyabrskoy");

  assert.ok(obninsk);
  assert.equal(obninsk.title, "МРНЦ им. А. Ф. Цыба");
  assert.equal(obninsk.city, "Обнинск, Калужская область");
  assert.ok(obninsk.supply.some((item) => item.includes("металлокассеты")));
  assert.match(obninsk.description, /поставка продолжается/i);
  // Projects with documented/local portfolio media keep multi-photo galleries.
  // Projects without such media continue to fall back to one clearly labelled
  // illustrative industry visual — see LEGAL_MEDIA_RIGHTS_REGISTER.md.
  assert.ok(obninsk.photos.length >= 3);
  assert.ok(solovinaya);
  assert.equal(solovinaya.photos.length, 3);
  assert.ok(klovskiy && klovskiy.photos.length >= 3);
  assert.doesNotMatch(klovskiy.photos[0].credit, /Иллюстративный визуал/);
  assert.ok(odkb);
  assert.equal(odkb.photos.length, 3);
  assert.doesNotMatch(odkb.photos[0].credit, /Иллюстративный визуал/);
  assert.ok(oncology && oncology.photos.length >= 2);
  assert.ok(vostok5);
  assert.equal(vostok5.photos.length, 3);
  assert.doesNotMatch(vostok5.photos[0].credit, /Иллюстративный визуал/);
  assert.ok(kutuzova);
  assert.equal(kutuzova.category, "commercial");
  assert.deepEqual(kutuzova.supply, ["металлокассеты"]);
  assert.equal(kutuzova.photos.length, 3);
  assert.doesNotMatch(kutuzova.photos[0].credit, /Иллюстративный визуал/);
  assert.ok(smolstrom);
  assert.equal(smolstrom.category, "residential");
  assert.deepEqual(smolstrom.supply, ["металлокассеты", "кронштейны для кондиционеров"]);
  assert.equal(smolstrom.photos.length, 1);
  assert.doesNotMatch(smolstrom.photos[0].credit, /Иллюстративный визуал/);

  for (const project of [unity, feniks]) {
    assert.ok(project);
    assert.equal(project.photos.length, 1);
    assert.match(project.photos[0].credit, /Иллюстративный визуал/);
  }
  assert.equal(realProjectsShowcase.some((project) => project.slug === "smolenskaya-oblastnaya-klinicheskaya-bolnitsa"), false);
  assert.equal(realProjectsShowcase.some((project) => project.slug === "kb-8-fmba-obninsk"), false);
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
      "MosBuild Summit",
      "FENESTRATION BAU China",
      "Металл-Экспо",
      "Big 5 Global",
      "DMP Greater Bay Area Industrial Expo",
      "RosBuild",
      "MosBuild",
      "Металлообработка",
      "АРХ Москва",
    ],
  );

  assert.equal(upcomingIndustryEvents.length, 14);

  for (const event of upcomingIndustryEvents) {
    assert.match(event.startDate, /^20(?:26|27)-/);
    assert.match(event.endDate, /^20(?:26|27)-/);
    assert.ok(event.endDate >= event.startDate);
    assert.match(event.url, /^https:\/\//);
  }

  for (let index = 1; index < upcomingIndustryEvents.length; index += 1) {
    assert.ok(upcomingIndustryEvents[index].startDate >= upcomingIndustryEvents[index - 1].startDate);
  }
});
