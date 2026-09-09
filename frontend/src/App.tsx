import { BrowserRouter as Router, Routes, Route, Navigate, useParams } from 'react-router-dom';
import { AppProviders } from './providers/AppProviders';
import { SignUp } from './features/auth/SignUp';
import { SignIn } from './features/auth/SignIn';
import { EmailConfirmation } from './features/auth/EmailConfirmation';
import { OrganizationResolver } from './features/organizations/OrganizationResolver';
import { Onboarding } from './features/organizations/Onboarding';
import { AppLayout } from './features/app/AppLayout';
import { ProtectedRoute } from './features/auth/ProtectedRoute';
import { RootRedirect } from './features/auth/RootRedirect';
import { PAGE_DEFINITIONS, DEFAULT_PAGE } from './components/tabs/pageDefinitions';

// Dashboard was removed — landing on an org with no sub-path now redirects
// to the first registered page (currently "members"). Change DEFAULT_PAGE
// in pageDefinitions.ts if you want a different landing page.
function OrgRootRedirect() {
  const { organizationId } = useParams<{ organizationId: string }>();
  return <Navigate to={`/app/organizations/${organizationId}/${DEFAULT_PAGE.path}`} replace />;
}

function App() {
  return (
    <AppProviders>
      <Router>
        <Routes>
          {/* Auth routes - outside the main layout */}
          <Route path="app/signup" element={<SignUp />} />
          <Route path="app/signin" element={<SignIn />} />
          <Route path="app/confirmation" element={<EmailConfirmation />} />
          <Route path="app/organization-resolver" element={<OrganizationResolver />} />
          <Route path="app/onboarding" element={<Onboarding />} />

          {/* Main app layout with nested routes */}
          <Route element={<ProtectedRoute />}>
            <Route path="app/organizations" element={<AppLayout />}>
              <Route path=":organizationId" element={<OrgRootRedirect />} />
              {PAGE_DEFINITIONS.map((def) => (
                <Route key={def.pageId} path={`:organizationId/${def.path}`} element={<def.component />} />
              ))}
            </Route>
          </Route>

          <Route path="app/" element={<RootRedirect />} />
          <Route path="/" element={<RootRedirect />} />
        </Routes>
      </Router>
    </AppProviders>
  );
}

export default App;