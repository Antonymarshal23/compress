import { Route, Routes } from 'react-router-dom';
import HomePage from './pages/HomePage';
import { CategoryPage, CategoriesPage, ContactPage, CookieAdPage, FaqPage, NotFoundPage, PublicLayout, PublicToolsPage, AboutPage, PrivacyPage, TermsPage } from './pages/PublicPages';
import { ToolRoute } from './pages/ToolRoute';
import { CookieConsent } from './components/CookieConsent';

export default function App() {
  return (
    <>
      <Routes>
        <Route path="/" element={<HomePage />} />
        <Route path="/tools/:slug" element={<ToolRoute />} />
        <Route element={<PublicLayout />}>
          <Route path="/tools" element={<PublicToolsPage />} />
          <Route path="/categories" element={<CategoriesPage />} />
          <Route path="/categories/:slug" element={<CategoryPage />} />
          <Route path="/about" element={<AboutPage />} />
          <Route path="/contact" element={<ContactPage />} />
          <Route path="/privacy" element={<PrivacyPage />} />
          <Route path="/terms" element={<TermsPage />} />
          <Route path="/cookies-and-ads" element={<CookieAdPage />} />
          <Route path="/faq" element={<FaqPage />} />
          <Route path="*" element={<NotFoundPage />} />
        </Route>
      </Routes>
      <CookieConsent />
    </>
  );
}
