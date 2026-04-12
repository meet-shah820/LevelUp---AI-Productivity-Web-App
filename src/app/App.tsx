import { RouterProvider } from 'react-router-dom';
import { router } from './routes';
import { Toaster } from './components/ui/sonner';

export default function App() {
  return (
    <div className="dark">
      <RouterProvider router={router} />
      <Toaster richColors closeButton position="top-center" />
    </div>
  );
}
