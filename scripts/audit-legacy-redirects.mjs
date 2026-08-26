const baseUrl = (process.env.SEO_AUDIT_BASE_URL ?? "http://127.0.0.1:3011").replace(/\/$/, "");
const canonicalOrigin = "https://www.steelprodukt.ru";

const legacyRedirects = new Map([
  ["/articles/ezhednevnaya-svodka-rossiya-politika-promyshlennost-28-07-2026", "/articles"],
  ["/articles/ezhednevnaya-svodka-metalloobrabotka-proizvodstvo-28-07-2026", "/articles"],
  ["/krovla", "/products"],
  ["/lomedii", "/products"],
  ["/otdekrf", "/products"],
  ["/dekorattivnie", "/products"],
  ["/dimli", "/solutions/engineering"],
  ["/korzina", "/solutions/climate"],
  ["/kronhtein", "/solutions/engineering"],
  ["/rehotka", "/solutions/engineering"],
  ["/vnutri", "/production/lazernaya-rezka-metalla"],
]);

const errors = [];

for (const [source, destination] of legacyRedirects) {
  const response = await fetch(`${baseUrl}${source}`, { redirect: "manual" });
  if (response.status !== 301) {
    errors.push(`${source}: ожидается 301, получен ${response.status}`);
    continue;
  }

  const location = response.headers.get("location");
  if (!location) {
    errors.push(`${source}: отсутствует Location`);
    continue;
  }

  const resolved = new URL(location, canonicalOrigin);
  const expected = new URL(destination, canonicalOrigin);
  if (resolved.href !== expected.href) {
    errors.push(`${source}: редирект ведёт на ${resolved.href} вместо ${expected.href}`);
  }
}

console.log(`SEO-аудит legacy-редиректов: ${legacyRedirects.size} URL`);
console.log(`Ошибки: ${errors.length}`);
if (errors.length) {
  errors.forEach((error) => console.log(`- ${error}`));
  process.exitCode = 1;
}
