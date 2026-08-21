import { Navigate, Route, Routes, useLocation } from 'react-router-dom';
import { auth } from './lib/api.ts';
import { DefectTypesPage } from './pages/DefectTypesPage.tsx';
import { DetailPage } from './pages/DetailPage.tsx';
import { ListPage } from './pages/ListPage.tsx';
import { LoginPage } from './pages/LoginPage.tsx';
import { NewInspectionPage } from './pages/NewInspectionPage.tsx';
import { SummaryPage } from './pages/SummaryPage.tsx';

/**
 * Presence of a token is enough to render; the API is the real authority and
 * answers 401 if it is expired, which clears it and bounces back here.
 */
function RequireAuth({ children }: { children: React.ReactElement }) {
  const location = useLocation();
  if (!auth.token) return <Navigate to="/login" replace state={{ from: location }} />;
  return children;
}

export function App() {
  return (
    <Routes>
      <Route path="/login" element={<LoginPage />} />
      <Route
        path="/*"
        element={
          <RequireAuth>
            <Routes>
              <Route path="/" element={<ListPage />} />
              <Route path="/new" element={<NewInspectionPage />} />
              <Route path="/inspections/:id" element={<DetailPage />} />
              <Route path="/summary" element={<SummaryPage />} />
              <Route path="/defect-types" element={<DefectTypesPage />} />
              <Route path="*" element={<Navigate to="/" replace />} />
            </Routes>
          </RequireAuth>
        }
      />
    </Routes>
  );
}
