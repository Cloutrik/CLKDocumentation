import type { Config } from "@docusaurus/types";
import type * as Preset from "@docusaurus/preset-classic";

const config: Config = {
  title: "CLOUTRIK Docs",
  tagline: "Cloud tricks, qualidade e engenharia real",
  favicon: "img/favicon.svg",

  url: "https://docs.cloutrik.com",
  baseUrl: "/",

  organizationName: "Cloutrik",
  projectName: "CLK-documentation",
  trailingSlash: true,

  onBrokenLinks: "throw",
  markdown: {
    hooks: {
      onBrokenMarkdownLinks: "warn"
    }
  },

  i18n: {
    defaultLocale: "pt-BR",
    locales: ["pt-BR"]
  },

  presets: [
    [
      "classic",
      {
        docs: {
          routeBasePath: "docs",
          sidebarPath: "./sidebars.ts"
        },
        blog: false,
        theme: {
          customCss: "./src/css/custom.css"
        }
      } satisfies Preset.Options
    ]
  ],

  themeConfig: {
    image: "img/social-card.png",
    navbar: {
      title: "CLOUTRIK Docs",
      logo: {
        alt: "CLOUTRIK",
        src: "img/logo.svg"
      },
      items: [
        {
          type: "docSidebar",
          sidebarId: "tutorialSidebar",
          position: "left",
          label: "Documentação"
        },
        {
          href: "https://cloutrik.com",
          label: "Homepage",
          position: "right"
        },
        {
          href: "https://github.com/Cloutrik",
          label: "GitHub",
          position: "right"
        }
      ]
    },
    footer: {
      style: "dark",
      copyright: `Copyright © ${new Date().getFullYear()} CLOUTRIK. Built with Docusaurus.`
    },
    prism: {
      theme: {
        plain: { color: "#f5f3ff", backgroundColor: "#140b28" },
        styles: []
      },
      darkTheme: {
        plain: { color: "#f5f3ff", backgroundColor: "#140b28" },
        styles: []
      }
    }
  } satisfies Preset.ThemeConfig
};

export default config;
