import { defineConfig } from 'astro/config';
import starlight from '@astrojs/starlight';

const repository = process.env.GITHUB_REPOSITORY?.split('/')[1];
const inferredBase = repository && !repository.endsWith('.github.io') ? `/${repository}/` : '/';

export default defineConfig({
  base: process.env.DOCS_BASE ?? inferredBase,
  site: process.env.DOCS_SITE ?? 'https://zuub-don.github.io',
  integrations: [
    starlight({
      title: 'Domstamp',
      description: 'Framework-neutral browser-state snapshots for automation and AI agents.',
      favicon: '/favicon.svg',
      lastUpdated: false,
      pagefind: true,
      credits: false,
      social: [
        { icon: 'github', label: 'GitHub', href: 'https://github.com/zuub-don/domstamp' }
      ],
      customCss: [
        '@fontsource-variable/ibm-plex-sans',
        '@fontsource-variable/newsreader',
        '@fontsource/ibm-plex-mono/400.css',
        '@fontsource/ibm-plex-mono/600.css',
        '/src/styles/custom.css'
      ],
      components: {
        SkipLink: './src/components/ContractSkipLink.astro',
        SiteTitle: './src/components/SiteTitle.astro'
      },
      sidebar: [
        { label: 'Overview', items: [
          { label: 'Introduction', slug: 'index' },
          { label: 'Why Domstamp', slug: 'concepts/why-domstamp' },
          { label: 'Browser boundaries', slug: 'concepts/browser-boundaries' }
        ] },
        { label: 'Start', items: [
          { label: 'Install and capture', slug: 'guides/getting-started' },
          { label: 'Choose a capture scope', slug: 'guides/capture-scopes' },
          { label: 'Frames and Shadow DOM', slug: 'guides/frames-and-shadow-dom' },
          { label: 'Capture closed Shadow DOM', slug: 'guides/closed-shadow-dom' },
          { label: 'Handle unstable pages', slug: 'guides/consistency' },
          { label: 'Redact sensitive captures', slug: 'guides/redaction' }
        ] },
        { label: 'Extend', items: [
          { label: 'Author an adapter', slug: 'extend/adapters' },
          { label: 'Write a plugin', slug: 'extend/plugins' }
        ] },
        { label: 'Reference', items: [
          { label: 'Configuration', slug: 'reference/configuration' },
          { label: 'Core API', slug: 'reference/core-api' },
          { label: 'Snapshot schema', slug: 'reference/snapshot-schema' },
          { label: 'Errors and diagnostics', slug: 'reference/errors' },
          { label: 'Playwright adapter', slug: 'reference/playwright' },
          { label: 'Puppeteer adapter', slug: 'reference/puppeteer' },
          { label: 'TQ1 codec', slug: 'reference/tq1' }
        ] },
        { label: 'Operate', items: [
          { label: 'Security and privacy', slug: 'operations/security' },
          { label: 'Conformance gym', slug: 'operations/gym' },
          { label: 'Chaos laboratory', slug: 'operations/chaos' },
          { label: 'Release status', slug: 'operations/release-status' },
          { label: 'Release procedure', slug: 'operations/releasing' }
        ] }
      ]
    })
  ]
});
