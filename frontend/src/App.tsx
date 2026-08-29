import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
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
import { GroupsPage } from './features/groups/GroupsPage';
import { RecordHistoryPage } from './features/versions/RecordHistoryPage';
import { PermissionHistoryPage } from './features/permissions/PermissionHistoryPage';
import { PermissionsPage } from './features/permissions/PermissionsPage';
import { ProtectedRoute } from './features/auth/ProtectedRoute';
import { RootRedirect } from './features/auth/RootRedirect';
import { OrganizationSettingsPage } from './features/organizations/OrganizationSettingsPage';
import { AccountingSettingsPage } from './features/accounting/settings/AccountingSettingsPage';
import { CenterTypesPage } from './features/accounting/centerTypes/CenterTypesPage';
import { CentersPage } from './features/accounting/centers/CentersPage';
import { ChartOfAccountsPage } from './features/accounting/chartOfAccounts/ChartOfAccountsPage';
import { FiscalYearsPage } from './features/fiscalYears/FiscalYearsPage';
import { JournalEntryPage } from './features/accounting/journalEntries/JournalEntryPage';
import { JournalEntriesPage } from './features/accounting/journalEntries/JournalEntriesPage';
import { JournalEntryEditPage } from './features/accounting/journalEntries/JournalEntryEditPage';

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
              <Route path=":organizationId" element={<Dashboard />} />
              <Route path=":organizationId/members" element={<MembersPage />} />
              <Route path=":organizationId/departments" element={<DepartmentsPage />} />
              <Route path=":organizationId/roles" element={<RolesPage />} />
              <Route path=":organizationId/groups" element={<GroupsPage />} />
              <Route path=":organizationId/record-history" element={<RecordHistoryPage />} />
              <Route path=":organizationId/permission-history" element={<PermissionHistoryPage />} />
              <Route path=":organizationId/permissions" element={<PermissionsPage />} />
              <Route path=":organizationId/fiscal-years" element={<FiscalYearsPage />} />
              <Route path=":organizationId/settings" element={<OrganizationSettingsPage />} />
              <Route path=":organizationId/accounting/settings" element={<AccountingSettingsPage />} />
              <Route path=":organizationId/accounting/center-types" element={<CenterTypesPage />} />
              <Route path=":organizationId/accounting/centers" element={<CentersPage />} />
              <Route path=":organizationId/accounting/chart-of-accounts" element={<ChartOfAccountsPage />} />
              <Route path=":organizationId/accounting/journal-entry" element={<JournalEntryPage />} />
              <Route path=":organizationId/accounting/journal-entries" element={<JournalEntriesPage />} />
              <Route path=":organizationId/accounting/journal-entries/:journalEntryId" element={<JournalEntryEditPage />} />
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