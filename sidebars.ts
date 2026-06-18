import type { SidebarsConfig } from "@docusaurus/plugin-content-docs";

const sidebars: SidebarsConfig = {
  tutorialSidebar: [
    "intro",
    {
      type: "category",
      label: "Fundamentos CLOUTRIK",
      items: ["qualidade", "commits", "cicd", "observabilidade"]
    },
    {
      type: "category",
      label: "Sistemas distribuidos",
      items: ["mensageria", "microservicos", "ranking"]
    }
  ]
};

export default sidebars;
