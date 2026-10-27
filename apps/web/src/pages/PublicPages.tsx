import type { ReactNode } from 'react';
import { useMemo, useState } from 'react';
import { Link, NavLink, Outlet, useParams } from 'react-router-dom';
import { AdSlot } from '../components/AdSlot';
import { Seo } from '../components/Seo';
import { categorySlug, publishedCategories, publishedTools } from '../data/tools';

const pageCopy = {
  about: {
    title: 'About PaperPilot',
    description: 'Learn what PaperPilot currently offers for everyday PDF tasks.',
    path: '/about',
  },
  contact: {
    title: 'Contact PaperPilot',
    description: 'Find out how to reach the operator responsible for this PaperPilot deployment.',
    path: '/contact',
  },
  privacy: {
    title: 'Privacy information',
    description: 'Understand how PDF uploads are handled by the current PaperPilot application.',
    path: '/privacy',
  },
  terms: {
    title: 'Terms of use',
    description: 'Read the general terms for using PaperPilot PDF tools.',
    path: '/terms',
  },
  cookies: {
    title: 'Cookies and advertising',
    description: 'Learn when PaperPilot advertising scripts are enabled and what that may mean for cookies.',
    path: '/cookies-and-ads',
  },
  faq: {
    title: 'Frequently asked questions',
    description: 'Answers about PaperPilot’s currently implemented PDF tools and file processing.',
    path: '/faq',
  },
};

function PublicPage({
  title,
  description,
  path,
  children,
  noindex = false,
}: {
  title: string;
  description: string;
  path: string;
  children: ReactNode;
  noindex?: boolean;
}) {
  return (
    <>
      <Seo title={`${title} | PaperPilot`} description={description} path={path} noindex={noindex} />
      <main className="mx-auto min-h-[60vh] max-w-5xl px-4 py-12 sm:px-6 lg:px-8">
        <div className="card p-6 sm:p-10">
          <h1 className="text-3xl font-black tracking-tight text-slate-900 sm:text-4xl">{title}</h1>
          <div className="prose prose-slate mt-6 max-w-none text-slate-600">{children}</div>
        </div>
      </main>
    </>
  );
}

export function PublicLayout() {
  const navItems = [
    { to: '/tools', label: 'All tools' },
    { to: '/categories', label: 'Categories' },
    { to: '/about', label: 'About' },
    { to: '/faq', label: 'FAQ' },
  ];

  return (
    <div className="min-h-screen text-slate-800">
      <header className="sticky top-0 z-20 border-b border-slate-200/80 bg-white/90 backdrop-blur-xl">
        <div className="mx-auto flex max-w-7xl flex-wrap items-center justify-between gap-4 px-4 py-4 sm:px-6 lg:px-8">
          <Link to="/" className="flex items-center gap-3 font-extrabold tracking-tight text-slate-900">
            <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary-600 text-lg text-white shadow-soft">P</span>
            PaperPilot
          </Link>
          <nav aria-label="Main navigation" className="flex flex-wrap items-center gap-x-5 gap-y-2 text-sm font-medium text-slate-600">
            {navItems.map(({ to, label }) => (
              <NavLink key={to} to={to} className={({ isActive }) => `${isActive ? 'text-primary-700' : ''} hover:text-primary-600`}>
                {label}
              </NavLink>
            ))}
          </nav>
        </div>
      </header>
      <AdSlot />
      <Outlet />
      <footer className="border-t border-slate-200 bg-white/80">
        <div className="mx-auto flex max-w-7xl flex-col gap-4 px-4 py-8 text-sm text-slate-600 sm:px-6 lg:flex-row lg:items-center lg:justify-between lg:px-8">
          <span>PaperPilot PDF tools</span>
          <nav aria-label="Footer navigation" className="flex flex-wrap gap-x-5 gap-y-2">
            <Link to="/contact" className="hover:text-primary-700">Contact</Link>
            <Link to="/privacy" className="hover:text-primary-700">Privacy</Link>
            <Link to="/terms" className="hover:text-primary-700">Terms</Link>
            <Link to="/cookies-and-ads" className="hover:text-primary-700">Cookies & ads</Link>
          </nav>
        </div>
      </footer>
    </div>
  );
}

export function PublicToolsPage() {
  const [query, setQuery] = useState('');
  const conversionCategories = ['Convert to PDF', 'Convert from PDF'];
  const matchingTools = useMemo(() => {
    const needle = query.trim().toLowerCase();
    if (!needle) return publishedTools;
    return publishedTools.filter((tool) =>
      [tool.name, tool.category, tool.description, ...tool.tags].some((value) => value.toLowerCase().includes(needle)),
    );
  }, [query]);

  return (
    <>
      <AdSlot slot={import.meta.env.VITE_ADSENSE_DIRECTORY_SLOT} />
      <PublicPage title="All available PDF tools" description="Browse PaperPilot PDF actions currently backed by implemented processing endpoints." path="/tools">
        <p>These tools correspond to processing operations currently implemented by the service. Review each description and its options before processing a document.</p>
        <section id="conversions" className="mt-8 scroll-mt-24">
          <h2 className="text-2xl font-bold text-slate-900">Convert files</h2>
          <p className="mt-2">Choose a direction, then select a file to upload and convert.</p>
          <div className="mt-4 grid gap-4 sm:grid-cols-2">
            {conversionCategories.map((category) => {
              const categoryTools = publishedTools.filter((tool) => tool.category === category);
              return (
                <section key={category} className="rounded-2xl border border-primary-200 bg-primary-50 p-5">
                  <h3 className="text-lg font-bold text-slate-900">{category}</h3>
                  <ul className="mt-3 flex flex-wrap gap-2">
                    {categoryTools.map((tool) => (
                      <li key={tool.slug}>
                        <Link to={`/tools/${tool.slug}`} className="inline-flex rounded-full border border-primary-200 bg-white px-3 py-1.5 text-sm font-medium text-primary-800 hover:border-primary-400">
                          {tool.name}
                        </Link>
                      </li>
                    ))}
                  </ul>
                </section>
              );
            })}
          </div>
        </section>
        <label className="mt-6 block text-sm font-semibold text-slate-700">
          Search available tools
          <input
            type="search"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Search by tool or task"
            className="mt-2 w-full rounded-xl border border-slate-300 bg-white px-4 py-3 font-normal"
          />
        </label>
        <div className="mt-8 grid gap-4 sm:grid-cols-2">
          {matchingTools.map((tool) => (
            <Link key={tool.slug} to={`/tools/${tool.slug}`} className="rounded-2xl border border-slate-200 bg-white p-5 transition hover:border-primary-300 hover:shadow-soft">
              <h2 className="text-lg font-bold text-slate-900">{tool.name}</h2>
              <p className="mt-2 text-sm leading-6 text-slate-600">{tool.description}</p>
              <span className="mt-4 inline-block text-sm font-semibold text-primary-700">Open tool →</span>
            </Link>
          ))}
        </div>
        {matchingTools.length === 0 ? <p className="mt-6" role="status">No available tools match that search.</p> : null}
      </PublicPage>
    </>
  );
}

export function CategoriesPage() {
  return (
    <PublicPage title="PDF tool categories" description="Explore currently available PaperPilot tools by category." path="/categories">
      <p>Categories include only tools with an implemented processing endpoint.</p>
      <ul className="mt-6 grid gap-3 sm:grid-cols-2">
        {publishedCategories.map((category) => (
          <li key={category.slug}>
            <Link className="block rounded-xl border border-slate-200 bg-white p-4 font-semibold text-primary-700 hover:border-primary-300" to={`/categories/${category.slug}`}>
              {category.name} <span aria-hidden="true">→</span>
            </Link>
          </li>
        ))}
      </ul>
    </PublicPage>
  );
}

export function CategoryPage() {
  const { slug } = useParams();
  const category = publishedCategories.find((item) => item.slug === slug);
  if (!category) return <NotFoundPage />;

  const tools = publishedTools.filter((tool) => categorySlug(tool.category) === category.slug);
  const description = `Browse available ${category.name.toLowerCase()} PDF tools in PaperPilot.`;
  return (
    <PublicPage title={`${category.name} tools`} description={description} path={`/categories/${category.slug}`}>
      <p>These tools are currently backed by implemented PDF processing operations.</p>
      <ul className="mt-6 space-y-3">
        {tools.map((tool) => (
          <li key={tool.slug}>
            <Link className="block rounded-xl border border-slate-200 bg-white p-4 hover:border-primary-300" to={`/tools/${tool.slug}`}>
              <span className="font-semibold text-slate-900">{tool.name}</span>
              <span className="mt-1 block text-sm text-slate-600">{tool.description}</span>
            </Link>
          </li>
        ))}
      </ul>
    </PublicPage>
  );
}

export function AboutPage() {
  return (
    <PublicPage {...pageCopy.about}>
      <p>PaperPilot is a web interface for a set of PDF processing operations. The available tools are listed in the <Link className="text-primary-700 underline" to="/tools">tools directory</Link>; availability is limited to operations implemented by the current service.</p>
      <p>Each published tool describes its current options and limitations. Some more advanced document operations remain unavailable.</p>
    </PublicPage>
  );
}

export function ContactPage() {
  return (
    <PublicPage {...pageCopy.contact}>
      <p>This application does not currently publish a support email address or contact form. For questions about a hosted instance, contact the organization or operator that provided its URL.</p>
      <p>Do not include documents or sensitive personal information in a support request unless the site operator has provided an approved channel.</p>
    </PublicPage>
  );
}

export function PrivacyPage() {
  return (
    <PublicPage {...pageCopy.privacy}>
      <p>When you use a processing tool, the selected file is sent to the PaperPilot API to perform that operation. Uploads are handled in memory during processing. Result files are written to private temporary directories outside the public web root, are served through one-time tokenized download links, and are removed after download or expiry. The configured retention period is controlled by the instance operator.</p>
      <p>The current application does not store uploaded documents in a database. Operational logs record the operation, duration, and success or failure, but are designed not to include document contents or passwords. Hosting, proxy, network, and system logs are outside this application’s control.</p>
      <p>Advertising scripts are disabled unless the deployment operator supplies actual AdSense publisher and placement IDs at build time and the visitor opts in through the advertising preference control. If enabled, third-party advertising may use cookies or similar technologies; see <Link className="text-primary-700 underline" to="/cookies-and-ads">cookies and advertising information</Link>. The operator must review applicable consent requirements before enabling ads.</p>
      <p>Review the privacy information supplied by the operator of the specific instance before uploading sensitive files. This general page is not a substitute for deployment-specific privacy disclosures.</p>
    </PublicPage>
  );
}

export function TermsPage() {
  return (
    <PublicPage {...pageCopy.terms}>
      <p>Use PaperPilot only for documents you are authorized to process. You are responsible for reviewing the output before relying on it.</p>
      <p>Tools are provided as implemented and may have limitations. In particular, conversions may not preserve complex layout, text extraction does not perform OCR, and optimization does not guarantee a smaller file. The operator of a hosted instance may publish additional terms that apply to your use.</p>
    </PublicPage>
  );
}

export function CookieAdPage() {
  return (
    <PublicPage {...pageCopy.cookies}>
      <p>Advertising is disabled unless <code>VITE_ADSENSE_CLIENT</code> and an applicable global or placement-specific slot are configured at frontend build time. A visitor must also opt in using the advertising preference control before the Google AdSense script is loaded.</p>
      <p>Third-party advertising services may use cookies or similar technologies subject to their own settings and policies. Visitors can accept or decline, and later change their choice from the cookie preferences control. The operator deploying this application is responsible for reviewing consent requirements in its jurisdictions and configuring real publisher and placement IDs.</p>
      <p>When IDs are absent or a visitor declines, the ad slot and its third-party script are not rendered or loaded. Advertising is not required to use any PDF tool.</p>
    </PublicPage>
  );
}

export function FaqPage() {
  return (
    <PublicPage {...pageCopy.faq}>
      <h2>Which tools can I use?</h2>
      <p>The current directory lists the operations with a wired processing endpoint and frontend workflow. Tools without an implemented workflow are not listed as available.</p>
      <h2>Can I choose pages or ranges?</h2>
      <p>Yes. Split supports page ranges or individual pages. Extraction, removal, and rotation accept page selections. Leave the rotation selection blank to rotate all pages.</p>
      <h2>Will compression always reduce the file size?</h2>
      <p>No. The available optimization is lossless and does not guarantee a smaller output; it returns an error rather than providing a larger file.</p>
      <h2>Can PaperPilot recognize scanned text?</h2>
      <p>Not in the current release. PDF text conversion only works when text is embedded in the file; OCR is planned for a later version.</p>
      <h2>Do Office conversions always preserve layout?</h2>
      <p>Office-to-PDF is not included in the current release. PDF-to-Office converts embedded text and does not preserve the original page layout.</p>
      <h2>Where are uploaded files processed?</h2>
      <p>Files are sent to the API serving the instance you are using. See its <Link className="text-primary-700 underline" to="/privacy">privacy information</Link> and the deployment operator's disclosures for details.</p>
    </PublicPage>
  );
}

export function NotFoundPage() {
  return (
    <PublicPage title="Page not found" description="The requested PaperPilot page could not be found." path="/404" noindex>
      <p>The address may be incorrect, or the page may no longer be available.</p>
      <p><Link className="font-semibold text-primary-700 underline" to="/">Return to PaperPilot home</Link> or browse the <Link className="font-semibold text-primary-700 underline" to="/tools">available tools</Link>.</p>
    </PublicPage>
  );
}
