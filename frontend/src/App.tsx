import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { AppProviders } from './providers/AppProviders';
import { SignUp } from './features/auth/SignUp';
import { SignIn } from './features/auth/SignIn';
import { EmailConfirmation } from './features/auth/EmailConfirmation';
import { OrganizationResolver } from './features/organizations/OrganizationResolver';
import { Onboarding } from './features/organizations/Onboarding';
import { AppLayout } from './features/app/AppLayout';
import { Dashboard } from './features/app/Dashboard';
import { MembersPage } from './features/members/MembersPage';
import { DepartmentsPage } from './features/departments/DepartmentsPage';
import { RolesPage } from './features/roles/RolesPage';

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
          <Route path="app/organizations" element={<AppLayout />}>
            <Route path=":organizationId" element={<Dashboard />} />
            <Route path=":organizationId/members" element={<MembersPage />} />
            <Route path=":organizationId/departments" element={<DepartmentsPage />} />
            <Route path=":organizationId/roles" element={<RolesPage />} />
          </Route>
          
          <Route path="app/" element={<Navigate to="/app/signin" replace />} />
          <Route path="/" element={<Navigate to="/app/signin" replace />} />
        </Routes>
      </Router>
    </AppProviders>
  );
}

export default App;