import { ArrowRight, CheckCircle2, FileText, Search, ShieldCheck, Sparkles } from 'lucide-react';
import { Link } from 'react-router-dom';
import { publishedTools } from '../data/tools';
import { Seo } from '../components/Seo';
import { AdSlot } from '../components/AdSlot';
import { PaperPilotBrand } from '../components/PaperPilotBrand';
import { useNavigate } from 'react-router-dom';
import { useDropzone } from 'react-dropzone';
import { useState } from 'react';
import { festivalDecoration, festivalMessage, getFestivalMode } from '../utils/festival-mode';

const iconMap = {
  Files: FileText,
  Scissors: FileText,
  Gauge: Sparkles,
  RotateCw: Sparkles,
  Trash2: Sparkles,
  Copy: FileText,
  LayoutGrid: FileText,
  Camera: Sparkles,
  ShieldCheck: ShieldCheck,
  TextSearch: Search,
};

export default function HomePage() {
  const navigate = useNavigate();
  const festival = getFestivalMode();
  const festivalIcons = festival ? festivalDecoration(festival) : [];
  const [uploadError, setUploadError] = useState('');
  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    accept: { 'application/pdf': ['.pdf'] },
    multiple: true,
    maxFiles: 10,
    maxSize: 25 * 1024 * 1024,
    onDrop: (files) => {
      setUploadError('');
      if (files.length < 2) {
        setUploadError('Select at least two PDF files to start merging.');
        return;
      }
      navigate('/tools/merge-pdf', { state: { files } });
    },
    onDropRejected: () => setUploadError('Choose up to 10 PDF files, each 25 MB or smaller.'),
  });

  return (
    <div className="min-h-screen text-slate-800">
      <Seo
        title="PaperPilot | PDF Tools for Everyday Documents"
        description="Merge, split, extract, rotate, remove pages, and optimize PDF files with PaperPilot’s currently available tools."
        path="/"
      />
      <header className="sticky top-0 z-20 border-b border-slate-200/80 bg-white/80 backdrop-blur-xl">
        <div className="mx-auto flex max-w-7xl items-center justify-between px-4 py-4 sm:px-6 lg:px-8">
          <Link to="/" aria-label="PaperPilot home">
            <PaperPilotBrand />
          </Link>

          <nav className="hidden items-center gap-8 text-sm font-medium text-slate-600 md:flex">
            <Link to="/tools" className="hover:text-primary-600">Tools</Link>
            <a href="#features" className="hover:text-primary-600">Features</a>
            <Link to="/faq" className="hover:text-primary-600">FAQ</Link>
            <Link to="/categories" className="hover:text-primary-600">Categories</Link>
          </nav>

          <div className="flex items-center gap-3">
            <Link to="/about" className="hidden rounded-full border border-slate-200 bg-white px-4 py-2 text-sm font-medium text-slate-700 shadow-sm md:inline-flex">About</Link>
            <Link to="/tools" className="inline-flex items-center gap-2 rounded-full bg-primary-600 px-4 py-2 text-sm font-semibold text-white shadow-soft transition hover:bg-primary-700">Browse tools <ArrowRight size={16} /></Link>
          </div>
        </div>
      </header>

      <main>
        <section className={`home-hero mx-auto max-w-7xl px-4 pb-16 pt-16 sm:px-6 lg:px-8${festival ? ` festival-${festival}` : ''}`}>
          {festival ? (
            <>
              <div className="festival-decoration" aria-hidden="true">
                {festivalDecoration(festival).map((decoration, index) => (
                  <span key={`${decoration}-${index}`} className={`festival-ornament ornament-${index + 1}`}>{decoration}</span>
                ))}
              </div>
              <div className="festival-greeting" role="note">
                <span className="festival-greeting-icon" aria-hidden="true">{festivalIcons[0]}</span>
                <span>{festivalMessage(festival)}</span>
                <span className="festival-greeting-icon" aria-hidden="true">{festivalIcons[festivalIcons.length - 1]}</span>
              </div>
            </>
          ) : null}
          <div className="grid items-center gap-10 lg:grid-cols-[1.2fr_0.8fr]">
            <div>
              <div className="mb-5 inline-flex items-center gap-2 rounded-full border border-primary-100 bg-primary-50 px-3 py-1 text-sm font-medium text-primary-700">
                <CheckCircle2 size={15} /> PDF tools for everyday document tasks
              </div>
              <h1 className="max-w-xl text-4xl font-black tracking-tight text-slate-900 sm:text-5xl lg:text-6xl">
                Powerful PDF tools for faster document work.
              </h1>
              <p className="mt-6 max-w-xl text-lg text-slate-600">
                Merge, split, extract, rotate, remove pages, and run an optimization pass on PDF files.
              </p>

              <div className="mt-8 flex flex-col gap-4 sm:flex-row">
                <Link to="/tools/merge-pdf" className="inline-flex items-center justify-center rounded-full bg-primary-600 px-6 py-3 text-base font-semibold text-white shadow-soft transition hover:bg-primary-700">Start merging PDFs</Link>
                <Link to="/tools#conversions" className="inline-flex items-center justify-center rounded-full border border-primary-200 bg-white px-6 py-3 text-base font-semibold text-primary-800 shadow-sm hover:border-primary-400">Convert files</Link>
                <a href="#tools" className="inline-flex items-center justify-center rounded-full border border-slate-200 bg-white px-6 py-3 text-base font-semibold text-slate-700 shadow-sm">Browse all tools</a>
              </div>

              <div
                {...getRootProps()}
                className="mt-6 cursor-pointer rounded-2xl border-2 border-dashed border-primary-200 bg-white/80 p-5 text-left transition hover:border-primary-400 focus-within:ring-2 focus-within:ring-primary-500"
              >
                <input {...getInputProps()} />
                <p className="font-semibold text-slate-800">{isDragActive ? 'Drop your PDFs to continue' : 'Drop 2–10 PDFs here to merge'}</p>
                <p className="mt-1 text-sm text-slate-500">PDF files only · up to 25 MB per file</p>
              </div>
              {uploadError ? <p className="mt-2 text-sm text-red-700" role="alert">{uploadError}</p> : null}

              <div className="mt-8 flex flex-wrap gap-4 text-sm text-slate-600">
                <span className="inline-flex items-center gap-2"><ShieldCheck size={16} className="text-green-600" /> PDF upload workflows</span>
                <span className="inline-flex items-center gap-2"><Sparkles size={16} className="text-primary-600" /> No sign-up needed</span>
              </div>
            </div>

            <div className="card p-6">
              <div className="rounded-2xl border border-dashed border-primary-200 bg-primary-50 p-5">
                <div className="mb-4 flex items-center justify-between">
                  <div className="text-sm font-semibold uppercase tracking-[0.12em] text-primary-700">Quick workflow</div>
                  <div className="rounded-full bg-white px-2 py-1 text-xs font-medium text-slate-600">PDF workflow</div>
                </div>
                <div className="space-y-4">
                  {['Upload document', 'Choose action', 'Download result'].map((step, index) => (
                    <div key={step} className="flex items-center gap-3 rounded-xl bg-white p-3 shadow-sm">
                      <div className="flex h-8 w-8 items-center justify-center rounded-full bg-primary-600 text-sm font-bold text-white">{index + 1}</div>
                      <div className="text-sm font-medium text-slate-700">{step}</div>
                    </div>
                  ))}
                </div>
                <div className="mt-5 rounded-xl border border-slate-200 bg-white p-4">
                  <div className="mb-2 flex items-center justify-between text-xs text-slate-500">
                    <span>Simple workflow</span>
                    <span>Upload · Process · Download</span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </section>

        <AdSlot slot={import.meta.env.VITE_ADSENSE_HOME_SLOT} />

        <section id="tools" className="mx-auto max-w-7xl px-4 py-12 sm:px-6 lg:px-8">
          <div className="mb-8 flex items-end justify-between gap-4">
            <div>
              <p className="text-sm font-semibold uppercase tracking-[0.12em] text-primary-700">Popular tools</p>
              <h2 className="mt-2 text-3xl font-bold tracking-tight text-slate-900">Available PDF tools</h2>
            </div>
            <Link to="/tools" className="hidden items-center gap-2 rounded-full border border-slate-200 bg-white px-3 py-2 text-sm text-slate-600 md:flex">
              <Search size={15} /> Search tools
            </Link>
          </div>

          <div className="tool-grid">
            {publishedTools.map((tool) => {
              const Icon = iconMap[tool.icon as keyof typeof iconMap] ?? FileText;
              return (
                <Link key={tool.slug} to={`/tools/${tool.slug}`} className="card group p-5 transition hover:-translate-y-1 hover:border-primary-200 hover:shadow-lg">
                  <div className="mb-4 inline-flex h-12 w-12 items-center justify-center rounded-2xl bg-primary-50 text-primary-700">
                    <Icon size={22} />
                  </div>
                  <div className="mb-2 flex items-center justify-between gap-2">
                    <h3 className="text-xl font-bold text-slate-900">{tool.name}</h3>
                    <span className="rounded-full bg-slate-100 px-2 py-1 text-[10px] font-semibold uppercase tracking-wide text-slate-600">{tool.status}</span>
                  </div>
                  <p className="text-sm leading-6 text-slate-600">{tool.description}</p>
                  <div className="mt-4 inline-flex items-center gap-2 text-sm font-semibold text-primary-700">
                    Open tool <ArrowRight size={16} />
                  </div>
                </Link>
              );
            })}
          </div>
        </section>

        <AdSlot slot={import.meta.env.VITE_ADSENSE_INLINE_SLOT} />

        <section id="features" className="bg-slate-900 py-16 text-white">
          <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
            <div className="mb-10 max-w-2xl">
              <p className="text-sm font-semibold uppercase tracking-[0.12em] text-blue-300">Why PaperPilot</p>
              <h2 className="mt-3 text-3xl font-bold tracking-tight">Built for real-world document work.</h2>
            </div>

            <div className="grid gap-6 md:grid-cols-3">
              {[
                ['Everyday PDF actions', 'Merge, split, extract, rotate, remove pages, and run the current optimization pass.'],
                ['Simple workflows', 'Upload a PDF, choose an available action, then download its result.'],
                ['Clear availability', 'Only tools backed by an implemented processing endpoint are listed as available.'],
              ].map(([title, description]) => (
                <div key={title} className="rounded-2xl border border-slate-700 bg-slate-800/80 p-6">
                  <div className="mb-4 h-11 w-11 rounded-xl bg-primary-500/20 text-primary-300" />
                  <h3 className="mb-3 text-xl font-bold">{title}</h3>
                  <p className="text-sm leading-6 text-slate-300">{description}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        <section id="faq" className="mx-auto max-w-6xl px-4 py-16 sm:px-6 lg:px-8">
          <div className="mb-8 text-center">
            <p className="text-sm font-semibold uppercase tracking-[0.12em] text-primary-700">FAQ</p>
            <h2 className="mt-3 text-3xl font-bold tracking-tight text-slate-900">Everything you need to know</h2>
          </div>

          <div className="space-y-4">
            {[
              ['Which PDF actions are available?', 'The tools directory lists the operations currently wired to real processing workflows.'],
              ['Can I select custom page ranges?', 'Split, extract, remove, and rotate pages expose options on their tool pages.'],
              ['Will optimization always reduce file size?', 'No. File-size reduction is not guaranteed.'],
            ].map(([question, answer]) => (
              <div key={question} className="card p-5">
                <h3 className="text-lg font-semibold text-slate-900">{question}</h3>
                <p className="mt-2 text-slate-600">{answer}</p>
              </div>
            ))}
            <Link to="/faq" className="inline-flex font-semibold text-primary-700 hover:underline">View all FAQs →</Link>
          </div>
        </section>
      </main>

      <footer className="border-t border-slate-200 bg-white/80">
        <div className="mx-auto flex max-w-7xl flex-col gap-6 px-4 py-8 text-sm text-slate-600 sm:px-6 lg:flex-row lg:items-center lg:justify-between lg:px-8">
          <div>© 2026 PaperPilot. Built for efficient document workflows.</div>
          <div className="flex flex-wrap gap-6">
            <Link to="/privacy">Privacy</Link>
            <Link to="/terms">Terms</Link>
            <Link to="/cookies-and-ads">Cookies & ads</Link>
            <Link to="/contact">Contact</Link>
          </div>
        </div>
      </footer>
    </div>
  );
}
