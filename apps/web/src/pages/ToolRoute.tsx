import { useParams } from 'react-router-dom';
import { tools } from '../data/tools';
import { NotFoundPage } from './PublicPages';
import ToolPage from './ToolPage';

export function ToolRoute() {
  const { slug } = useParams();
  return tools.some((tool) => tool.slug === slug) ? <ToolPage /> : <NotFoundPage />;
}
