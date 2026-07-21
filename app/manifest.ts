import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Сталь Продукт — инженерные решения из листового металла",
    short_name: "Сталь Продукт",
    description: "Проектирование, производство и поставка инженерных решений из листового металла.",
    start_url: "/",
    display: "browser",
    background_color: "#101112",
    theme_color: "#101112",
    lang: "ru",
  };
}
