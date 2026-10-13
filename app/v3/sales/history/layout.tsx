import AdminPageGate from '@/components/AdminPageGate';
import WorkspacePage from '@/components/WorkspacePage';
export default function Layout({children}: {children: React.ReactNode}) { return <AdminPageGate><WorkspacePage>{children}</WorkspacePage></AdminPageGate>; }
